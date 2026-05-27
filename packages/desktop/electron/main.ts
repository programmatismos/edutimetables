import { app, BrowserWindow, ipcMain, dialog, Notification, Menu, MenuItem } from "electron";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";

const require = createRequire(import.meta.url);

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// app.isPackaged is the reliable way to detect production in Electron.
// NODE_ENV is NOT set to "production" automatically by electron-builder.
const isDev = !app.isPackaged;
const WEB_DEV_URL = process.env.WEBSITE_URL ?? "http://localhost:3000";

// In production: web-dist is sibling to dist-electron
const WEB_DIST = path.join(__dirname, "../web-dist");

let win: BrowserWindow | null;
let apiPort = 0;

// ─── MIME types ────────────────────────────────────────────────────────────────
const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js":   "application/javascript",
  ".mjs":  "application/javascript",
  ".css":  "text/css",
  ".json": "application/json",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif":  "image/gif",
  ".svg":  "image/svg+xml",
  ".ico":  "image/x-icon",
  ".woff": "font/woff",
  ".woff2":"font/woff2",
  ".ttf":  "font/ttf",
  ".map":  "application/json",
};

function getMime(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME[ext] ?? "application/octet-stream";
}

// ─── Embedded server (API + static files) ─────────────────────────────────────

async function startServer(): Promise<number> {
  if (isDev) return 0;

  // Point DB to userData so it persists across updates
  const userDataPath = app.getPath("userData");
  const dbPath = path.join(userDataPath, "local.db");

  // Seed DB from resources on first run
  const seedDb = path.join(process.resourcesPath, "local.db");
  if (!fsSync.existsSync(dbPath)) {
    if (fsSync.existsSync(seedDb)) {
      try {
        await fs.copyFile(seedDb, dbPath);
        console.log("[main] seeded local.db from", seedDb);
      } catch (e) {
        console.warn("[main] could not seed db:", e);
      }
    }
  }

  // Set DATABASE_SQLITE_PATH so the DB layer uses better-sqlite3 (no native loader issues)
  process.env.DATABASE_SQLITE_PATH = dbPath;
  // Clear any remote Turso vars
  delete process.env.DATABASE_URL;
  delete process.env.DATABASE_AUTH_TOKEN;

  // Tell the DB layer where to find better-sqlite3 (inside app.asar.unpacked)
  // The bundled api-server.cjs uses require() which resolves relative to the bundle,
  // but native modules are unpacked from asar — we pass the exact path via env var.
  const unpackedModules = path.join(process.resourcesPath, "app.asar.unpacked", "node_modules");
  process.env.ELECTRON_MODULES_PATH = unpackedModules;

  // Import the pre-bundled API server (built by esbuild in CI)
  // Path: dist-electron/api-server.cjs (sibling to main.js)
  const serverModulePath = path.join(__dirname, "api-server.cjs");
  const serverModule = await import(pathToFileURL(serverModulePath).href);
  // esbuild CJS bundle wraps ESM default export as module.exports.default
  // dynamic import() of a CJS file gives { default: module.exports }
  // so the Hono app is at serverModule.default.default
  const rawExport = serverModule?.default;
  const honoApp = rawExport?.default ?? rawExport;
  if (typeof honoApp?.fetch !== "function") {
    throw new Error(`honoApp.fetch is not a function. Got: ${JSON.stringify(Object.keys(rawExport ?? {}))}`);
  }

  return new Promise((resolve, reject) => {
    const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      const urlStr = req.url ?? "/";

      // ── API requests → Hono ────────────────────────────────────────────────
      if (urlStr.startsWith("/api")) {
        try {
          const url = new URL(urlStr, `http://127.0.0.1`);
          const headers = new Headers();
          for (const [key, val] of Object.entries(req.headers)) {
            if (val) headers.set(key, Array.isArray(val) ? val.join(", ") : val);
          }
          const hasBody = req.method !== "GET" && req.method !== "HEAD";
          let body: BodyInit | undefined;
          if (hasBody) {
            body = await new Promise<Buffer>((res, rej) => {
              const chunks: Buffer[] = [];
              req.on("data", (c: Buffer) => chunks.push(c));
              req.on("end", () => res(Buffer.concat(chunks)));
              req.on("error", rej);
            });
          }
          const webReq = new Request(url, { method: req.method, headers, body });
          const webRes = await honoApp.fetch(webReq);
          res.statusCode = webRes.status;
          webRes.headers.forEach((val: string, key: string) => res.setHeader(key, val));
          res.end(Buffer.from(await webRes.arrayBuffer()));
        } catch (err: any) {
          const msg = err?.stack ?? err?.message ?? String(err);
          console.error("[api] error:", msg);
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: msg }));
        }
        return;
      }

      // ── Debug info ──────────────────────────────────────────────────────────
      if (urlStr === "/__debug") {
        const files = fsSync.existsSync(WEB_DIST) ? fsSync.readdirSync(WEB_DIST) : ["WEB_DIST NOT FOUND"];
        const dbPath = path.join(app.getPath("userData"), "local.db");
        const info = {
          WEB_DIST,
          webDistExists: fsSync.existsSync(WEB_DIST),
          webDistFiles: files,
          dbPath,
          dbExists: fsSync.existsSync(dbPath),
          DATABASE_URL: process.env.DATABASE_URL,
          __dirname,
        };
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(info, null, 2));
        return;
      }

      // ── Static files → web-dist ─────────────────────────────────────────────
      try {
        let filePath = urlStr.split("?")[0].replace(/^\//, "");
        let fullPath = path.join(WEB_DIST, filePath);

        let stat: fsSync.Stats | null = null;
        try { stat = fsSync.statSync(fullPath); } catch {}

        if (!stat || stat.isDirectory()) {
          const indexInDir = path.join(fullPath, "index.html");
          fullPath = fsSync.existsSync(indexInDir)
            ? indexInDir
            : path.join(WEB_DIST, "index.html");
        }

        const content = fsSync.readFileSync(fullPath);
        res.statusCode = 200;
        res.setHeader("Content-Type", getMime(fullPath));
        res.end(content);
      } catch {
        res.statusCode = 404;
        res.end("Not found");
      }
    });

    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      console.log(`[server] listening on http://127.0.0.1:${port}`);
      resolve(port);
    });

    server.on("error", reject);
  });
}

// ─── Window ───────────────────────────────────────────────────────────────────

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "EduTimetables",
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.webContents.on("did-fail-load", (_e, code, desc, url) => {
    console.error(`[renderer] did-fail-load: ${code} ${desc} ${url}`);
    win?.loadURL(
      `data:text/html,<pre style="font-family:monospace;padding:20px;color:red">` +
      `Failed to load: ${desc} (${code})\nURL: ${url}\napiPort: ${apiPort}</pre>`
    );
  });

  win.webContents.on("console-message", (_e, level, msg, line, src) => {
    console.log(`[renderer][${level}] ${msg} (${src}:${line})`);
  });

  if (isDev) {
    win.loadURL(WEB_DEV_URL);
  } else {
    win.loadURL(`http://127.0.0.1:${apiPort}`);
  }

  // F12 toggles DevTools (useful for debugging in production)
  win.webContents.on("before-input-event", (_e, input) => {
    if (input.key === "F12" && input.type === "keyDown") {
      win?.webContents.isDevToolsOpened()
        ? win.webContents.closeDevTools()
        : win?.webContents.openDevTools();
    }
  });
}

// ─── Application Menu ─────────────────────────────────────────────────────────
function setupMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: "File",
      submenu: [
        { role: "quit" as const },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" as const },
        { role: "redo" as const },
        { type: "separator" as const },
        { role: "cut" as const },
        { role: "copy" as const },
        { role: "paste" as const },
        { role: "selectAll" as const },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" as const },
        { role: "toggleDevTools" as const },
        { type: "separator" as const },
        { role: "resetZoom" as const },
        { role: "zoomIn" as const },
        { role: "zoomOut" as const },
        { type: "separator" as const },
        { role: "togglefullscreen" as const },
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Check for Updates",
          click: () => checkForUpdatesManually(),
        },
        { type: "separator" as const },
        {
          label: `About EduTimetables v${app.getVersion()}`,
          click: () => {
            dialog.showMessageBox({
              type: "info",
              title: "About EduTimetables",
              message: `EduTimetables v${app.getVersion()}`,
              detail: "School timetable management made simple.",
              buttons: ["OK"],
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// ─── Auto-updater ─────────────────────────────────────────────────────────────
let _updaterReady: Promise<any> | null = null;

function checkForUpdatesManually() {
  if (isDev) {
    dialog.showMessageBox({
      type: "info",
      title: "Έλεγχος Ενημερώσεων",
      message: "Λειτουργεί μόνο σε παραγωγή.",
      detail: `Τρέχουσα έκδοση: v${app.getVersion()}`,
      buttons: ["OK"],
    });
    return;
  }

  if (!_updaterReady) {
    dialog.showMessageBox({
      type: "warning",
      title: "Έλεγχος Ενημερώσεων",
      message: "Η υπηρεσία ενημερώσεων δεν φορτώθηκε.",
      detail: "Κλείστε και ανοίξτε ξανά την εφαρμογή.",
      buttons: ["OK"],
    });
    return;
  }

  _updaterReady.then((autoUpdater) => {
    let settled = false;

    const onAvailable = (_info: any) => {
      if (settled) return; settled = true;
      autoUpdater.removeListener("update-not-available", onNotAvailable);
      autoUpdater.removeListener("error", onError);
      // renderer handles the banner via updater:available IPC event
    };
    const onNotAvailable = () => {
      if (settled) return; settled = true;
      autoUpdater.removeListener("update-available", onAvailable);
      autoUpdater.removeListener("error", onError);
      dialog.showMessageBox(win!, {
        type: "info",
        title: "Έλεγχος Ενημερώσεων",
        message: "Χρησιμοποιείτε την τελευταία έκδοση.",
        detail: `Εγκατεστημένη έκδοση: v${app.getVersion()}`,
        buttons: ["OK"],
      });
    };
    const onError = (err: Error) => {
      if (settled) return; settled = true;
      autoUpdater.removeListener("update-available", onAvailable);
      autoUpdater.removeListener("update-not-available", onNotAvailable);
      dialog.showMessageBox(win!, {
        type: "error",
        title: "Σφάλμα Ενημερώσεων",
        message: "Αδύνατος ο έλεγχος ενημερώσεων.",
        detail: err.message,
        buttons: ["OK"],
      });
    };

    autoUpdater.once("update-available", onAvailable);
    autoUpdater.once("update-not-available", onNotAvailable);
    autoUpdater.once("error", onError);
    autoUpdater.checkForUpdates();
  });
}

function setupAutoUpdater() {
  if (isDev) return;

  _updaterReady = import("electron-updater").then(({ autoUpdater }) => {
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.autoDownload = false;

    setTimeout(() => autoUpdater.checkForUpdates(), 3000);
    setInterval(() => autoUpdater.checkForUpdates(), 4 * 60 * 60 * 1000);

    autoUpdater.on("update-available", (info) => {
      win?.webContents.send("updater:available", {
        version: info.version,
        releaseNotes: info.releaseNotes ?? null,
      });
    });

    autoUpdater.on("download-progress", (progress) => {
      win?.webContents.send("updater:progress", {
        percent: Math.round(progress.percent),
        transferred: progress.transferred,
        total: progress.total,
      });
    });

    autoUpdater.on("update-downloaded", (info) => {
      win?.webContents.send("updater:downloaded", { version: info.version });
    });

    autoUpdater.on("update-not-available", () => {
      win?.webContents.send("updater:not-available");
    });

    autoUpdater.on("error", (err) => {
      win?.webContents.send("updater:error", { message: err.message });
    });

    ipcMain.handle("updater:download", () => autoUpdater.downloadUpdate());
    ipcMain.handle("updater:install", () => autoUpdater.quitAndInstall());
    // Wrap checkForUpdates so we always send not-available back to renderer
    ipcMain.handle("updater:check", () =>
      autoUpdater.checkForUpdates().then((result: any) => {
        // If no update is pending download, notify renderer
        if (!result?.updateInfo?.version || result.updateInfo.version === app.getVersion()) {
          win?.webContents.send("updater:not-available");
        }
        return result;
      }).catch((err: Error) => {
        win?.webContents.send("updater:error", { message: err.message });
      })
    );

    return autoUpdater;
  }).catch((err) => {
    console.error("electron-updater failed to load:", err);
  });
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

ipcMain.handle("dialog:open", async (_, opts) => {
  const result = await dialog.showOpenDialog(opts);
  return result.canceled ? [] : result.filePaths;
});

ipcMain.handle("dialog:save", async (_, opts) => {
  const result = await dialog.showSaveDialog(opts);
  return result.canceled ? null : result.filePath;
});

ipcMain.handle("fs:read", async (_, filePath: string) => {
  return fs.readFile(filePath, "utf-8");
});

ipcMain.handle("fs:write", async (_, filePath: string, data: string) => {
  await fs.writeFile(filePath, data, "utf-8");
});

ipcMain.handle("notification:show", (_, title: string, body: string) => {
  new Notification({ title, body }).show();
});

ipcMain.handle("window:minimize", () => win?.minimize());
ipcMain.handle("window:maximize", () => {
  if (win?.isMaximized()) win.unmaximize();
  else win?.maximize();
});
ipcMain.handle("window:close", () => win?.close());

ipcMain.handle("app:version", () => app.getVersion());

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.whenReady().then(async () => {
  try {
    apiPort = await startServer();
    console.log(`[main] server started on port ${apiPort}`);
  } catch (err) {
    console.error("[main] FATAL: server failed to start:", err);
    // Show error window so user sees something useful
    const errWin = new BrowserWindow({ width: 900, height: 600, title: "EduTimetables — Startup Error" });
    errWin.loadURL(`data:text/html,<pre style="font-family:monospace;padding:20px;color:red">Server failed to start:\n${String(err)}</pre>`);
    return;
  }
  setupMenu();
  createWindow();
  setupAutoUpdater();
});
