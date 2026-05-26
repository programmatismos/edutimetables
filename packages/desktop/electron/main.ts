import { app, BrowserWindow, ipcMain, dialog, Notification } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const isDev = process.env.NODE_ENV !== "production";
const WEB_DEV_URL = process.env.WEBSITE_URL ?? "http://localhost:3000";
const WEB_DIST = path.join(__dirname, "../web-dist");

let win: BrowserWindow | null;

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    win.loadURL(WEB_DEV_URL);
  } else {
    win.loadFile(path.join(WEB_DIST, "index.html"));
  }
}

// ─── Auto-updater (production only) ─────────────────────────────────────────
// Only runs when packaged — skipped in dev so bun dev works fine.
function setupAutoUpdater() {
  if (isDev) return;

  // Dynamic import so the dev build doesn't fail if electron-updater
  // isn't bundled into the renderer side.
  import("electron-updater").then(({ autoUpdater }) => {
    // Don't auto-install silently — ask the user first.
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.autoDownload = false; // download only after user confirms

    // Check for updates 3 seconds after startup (give the window time to load)
    setTimeout(() => autoUpdater.checkForUpdates(), 3000);

    // Also check every 4 hours while the app is running
    setInterval(() => autoUpdater.checkForUpdates(), 4 * 60 * 60 * 1000);

    autoUpdater.on("update-available", (info) => {
      win?.webContents.send("updater:available", {
        version: info.version,
        releaseNotes: info.releaseNotes ?? null,
      });
    });

    autoUpdater.on("update-not-available", () => {
      // Silently ignore — only notify when triggered manually
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

    // IPC: renderer asks to start download
    ipcMain.handle("updater:download", () => autoUpdater.downloadUpdate());

    // IPC: renderer asks to install now (quits & relaunches)
    ipcMain.handle("updater:install", () => autoUpdater.quitAndInstall());

    // IPC: renderer manually triggers a check
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

// Expose current app version to renderer
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

app.whenReady().then(() => {
  createWindow();
  setupAutoUpdater();
});
