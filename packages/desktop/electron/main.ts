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

// Auto updater για production.
// Στο packaged app ενεργοποιείται κανονικά. Στο development καταχωρούμε μόνο
// ασφαλή no-op handlers, επειδή το preload εκθέτει τα ίδια methods και στα δύο modes.
function setupAutoUpdater() {
  if (isDev) {
    // Στο development το preload εκθέτει πάντα updater methods.
    // Καταχωρούμε no-op handlers για να μην σκάει ο renderer με
    // "No handler registered" όταν δεν υπάρχει πραγματικός auto-updater.
    ipcMain.handle("updater:download", () => null);
    ipcMain.handle("updater:install", () => null);
    ipcMain.handle("updater:check", () => null);
    return;
  }

  // Το electron-updater φορτώνεται δυναμικά μόνο στο production.
  // Έτσι το development build μένει ελαφρύ και δεν απαιτεί πραγματικό updater runtime.
  import("electron-updater").then(({ autoUpdater }) => {
    // Δεν εγκαθιστούμε ενημερώσεις σιωπηλά. Η εγκατάσταση γίνεται μόνο μετά
    // από ενέργεια του χρήστη μέσα από το UI.
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.autoDownload = false; // Λήψη μόνο αφού το ζητήσει ο χρήστης.

    // Περιμένουμε λίγο μετά την εκκίνηση ώστε να φορτώσει πρώτα το παράθυρο
    // και μετά ελέγχουμε αν υπάρχει διαθέσιμη ενημέρωση.
    setTimeout(() => autoUpdater.checkForUpdates(), 3000);

    // Κάνουμε περιοδικό έλεγχο όσο η εφαρμογή μένει ανοιχτή, ώστε ο χρήστης
    // να ενημερώνεται χωρίς να χρειάζεται επανεκκίνηση.
    setInterval(() => autoUpdater.checkForUpdates(), 4 * 60 * 60 * 1000);

    autoUpdater.on("update-available", (info) => {
      win?.webContents.send("updater:available", {
        version: info.version,
        releaseNotes: info.releaseNotes ?? null,
      });
    });

    autoUpdater.on("update-not-available", () => {
      // Δεν ενοχλούμε τον χρήστη όταν δεν υπάρχει ενημέρωση. Μήνυμα χρειάζεται
      // μόνο όταν υπάρχει διαθέσιμη έκδοση ή όταν αποτύχει ο updater.
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

    // IPC από τον renderer για έναρξη λήψης ενημέρωσης.
    ipcMain.handle("updater:download", () => autoUpdater.downloadUpdate());

    // IPC από τον renderer για εγκατάσταση τώρα, η οποία κλείνει και ανοίγει ξανά την εφαρμογή.
    ipcMain.handle("updater:install", () => autoUpdater.quitAndInstall());

    // IPC από τον renderer για χειροκίνητο έλεγχο ενημερώσεων.
    ipcMain.handle("updater:check", () => autoUpdater.checkForUpdates());
  }).catch((err) => {
    console.error("electron-updater failed to load:", err);
  });
}

// IPC handlers για λειτουργίες παραθύρου, αρχείων και ειδοποιήσεων.

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

// Εκθέτουμε την έκδοση της εφαρμογής στον renderer για προβολή στο UI.
ipcMain.handle("app:version", () => app.getVersion());

// Κύκλος ζωής εφαρμογής Electron.

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
