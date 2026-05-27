import { ipcRenderer, contextBridge } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,

  // Dialog
  showOpenDialog: (opts: Electron.OpenDialogOptions) =>
    ipcRenderer.invoke("dialog:open", opts),
  showSaveDialog: (opts: Electron.SaveDialogOptions) =>
    ipcRenderer.invoke("dialog:save", opts),

  // File system
  readFile: (path: string) => ipcRenderer.invoke("fs:read", path),
  writeFile: (path: string, data: string) =>
    ipcRenderer.invoke("fs:write", path, data),

  // Notifications
  showNotification: (title: string, body: string) =>
    ipcRenderer.invoke("notification:show", title, body),

  // Window controls
  minimize: () => ipcRenderer.invoke("window:minimize"),
  maximize: () => ipcRenderer.invoke("window:maximize"),
  close:    () => ipcRenderer.invoke("window:close"),

  // App info
  getVersion: () => ipcRenderer.invoke("app:version"),

  // Auto-updater
  updater: {
    check:    () => ipcRenderer.invoke("updater:check"),
    download: () => ipcRenderer.invoke("updater:download"),
    install:  () => ipcRenderer.invoke("updater:install"),
    onAvailable:  (cb: (info: { version: string; releaseNotes: string | null }) => void) => {
      ipcRenderer.on("updater:available", (_, info) => cb(info));
      return () => ipcRenderer.removeAllListeners("updater:available");
    },
    onProgress: (cb: (p: { percent: number; transferred: number; total: number }) => void) => {
      ipcRenderer.on("updater:progress", (_, p) => cb(p));
      return () => ipcRenderer.removeAllListeners("updater:progress");
    },
    onDownloaded: (cb: (info: { version: string }) => void) => {
      ipcRenderer.on("updater:downloaded", (_, info) => cb(info));
      return () => ipcRenderer.removeAllListeners("updater:downloaded");
    },
    onError: (cb: (err: { message: string }) => void) => {
      ipcRenderer.on("updater:error", (_, err) => cb(err));
      return () => ipcRenderer.removeAllListeners("updater:error");
    },
    onManualCheck: (cb: () => void) => {
      ipcRenderer.on("updater:manual-check", () => cb());
      return () => ipcRenderer.removeAllListeners("updater:manual-check");
    },
  },

  // Events from main → renderer
  onDeepLink: (cb: (url: string) => void) => {
    ipcRenderer.on("deep-link", (_, url) => cb(url));
    return () => ipcRenderer.removeAllListeners("deep-link");
  },
});
