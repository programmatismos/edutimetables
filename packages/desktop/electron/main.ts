import { app, BrowserWindow, ipcMain, dialog, Notification } from "electron";
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

  // Set env before importing the API so DB client picks it up at module init
  process.env.DATABASE_URL = `file:${dbPath}`;
  delete process.env.DATABASE_AUTH_TOKEN;

  // Native modules (libsql, @neon-rs/load, detect-libc) are unpacked from the
  // asar to app.asar.unpacked/node_modules — we must prepend that path so
  // require() finds them instead of the asar-virtual path (which can't load .node files).
  const unpackedModules = path.join(process.resourcesPath, "app.asar.unpacked", "node_modules");
  if (fsSync.existsSync(unpackedModules)) {
    const Module = require("module");
    Module.globalPaths.unshift(unpackedModules);
    // Also patch NODE_PATH for any child processes
    process.env.NODE_PATH = unpackedModules + path.delimiter + (process.env.NODE_PATH ?? "");
    Module._initPaths();
    console.log("[main] prepended unpacked node_modules:", unpackedModules);
  } else {
    console.warn("[main] unpacked node_modules not found at:", unpackedModules);
  }

  // Import the pre-bundled API server (built by esbuild in CI)
  // Path: dist-electron/api-server.cjs (sibling to main.js)
  const serverModulePath = path.join(__dirname, "api-server.cjs");
  const { default: honoApp } = await import(pathToFileURL(serverModulePath).href);

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
        } catch (err) {
          console.error("[api] error:", err);
          res.statusCode = 500;
          res.end("Internal Server Error");
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

  // Always open DevTools so we can see console errors — remove once stable
  win.webContents.openDevTools({ mode: "detach" });

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
}

// ─── Auto-updater ─────────────────────────────────────────────────────────────
function setupAutoUpdater() {
  if (isDev) return;

  import("electron-updater").then(({ autoUpdater }) => {
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

    autoUpdater.on("error", (err) => {
      win?.webContents.send("updater:error", { message: err.message });
    });

    ipcMain.handle("updater:download", () => autoUpdater.downloadUpdate());
    ipcMain.handle("updater:install", () => autoUpdater.quitAndInstall());
    ipcMain.handle("updater:check", () => autoUpdater.checkForUpdates());
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
  createWindow();
  setupAutoUpdater();
});
