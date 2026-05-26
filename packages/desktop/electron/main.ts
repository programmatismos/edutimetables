import { app, BrowserWindow, ipcMain, dialog, Notification } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const isDev = process.env.NODE_ENV !== "production";
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

  // The native libsql binary lives in resources alongside the app
  // Prepend resourcesPath to NODE_PATH so the native addon can be found
  const nativeDir = path.join(process.resourcesPath, "native_modules");
  if (fsSync.existsSync(nativeDir)) {
    process.env.NODE_PATH = nativeDir + path.delimiter + (process.env.NODE_PATH ?? "");
    // @ts-ignore
    require("module").Module._initPaths();
  }

  // Import the pre-bundled API server (built by esbuild in CI)
  // Path: dist-electron/api-server.cjs (sibling to main.js)
  const serverModulePath = path.join(__dirname, "api-server.cjs");
  const { default: honoApp } = await import(serverModulePath);

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
  apiPort = await startServer();
  createWindow();
  setupAutoUpdater();
});
