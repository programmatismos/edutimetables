# Desktop

## Overview

`packages/desktop` is a thin Electron shell. It has **no separate renderer by default** — it loads the web app from the server and exposes native capabilities via an IPC bridge.

Desktop-specific UI should usually still live in `packages/web/src/client/` and be gated with `useDesktop()` / `window.electronAPI`. Only create a separate desktop renderer if the user explicitly asks for a different desktop-only UI architecture (for example, a launcher, splash screen, offline-only shell, or a completely different desktop product).

## Architecture

```
packages/desktop/
  electron/
    main.ts              Electron main process (window, IPC handlers)
    preload.ts           contextBridge: exposes typed API to renderer as window.electronAPI
    electron-env.d.ts    Environment type declarations
    no-renderer.ts       Empty Vite input; desktop has no renderer UI of its own
  vite.config.ts         Vite builds main + preload
  electron-builder.json5 Packaging config
```

In **dev**, the main process loads the web from the server.
In **production**, it loads the built web app copied into `web-dist/`.

## Adding Desktop-Specific UI

Keep desktop-only UI in the web client unless the user explicitly requests a separate desktop renderer.

```tsx
import { useDesktop } from "../hooks/use-desktop";

function DesktopToolbar() {
  const desktop = useDesktop();
  if (!desktop) return null;

  return (
    <div>
      <button onClick={() => desktop.minimize()}>Minimize</button>
      <button onClick={() => desktop.maximize()}>Maximize</button>
      <button onClick={() => desktop.close()}>Close</button>
    </div>
  );
}
```

For desktop-only pages, render a fallback when not running in Electron:

```tsx
function DesktopSettingsPage() {
  const desktop = useDesktop();
  if (!desktop) return <p>This page is only available in the desktop app.</p>;

  return <DesktopSettings />;
}
```

Use this pattern for custom titlebars, desktop-only sidebars/actions, file open/save UI, notification controls, keyboard shortcut hints, and UI for native integrations exposed via IPC.

## Adding a Native Feature

Three steps: IPC handler → preload exposure → web type + usage.

### 1. Add IPC handler in `electron/main.ts`

```ts
import { ipcMain, shell } from "electron";

ipcMain.handle("shell:openExternal", async (_, url: string) => {
  await shell.openExternal(url);
});
```

### 2. Expose in `electron/preload.ts`

```ts
contextBridge.exposeInMainWorld("electronAPI", {
  // ... existing APIs
  openExternal: (url: string) => ipcRenderer.invoke("shell:openExternal", url),
});
```

### 3. Add type in `packages/web/src/client/lib/desktop.ts`

```ts
export interface ElectronAPI {
  // ... existing types
  openExternal: (url: string) => Promise<void>;
}
```

### 4. Use in web components

```tsx
import { useDesktop } from "../hooks/use-desktop";

function ExternalLink({ url, children }) {
  const desktop = useDesktop();

  const handleClick = (e) => {
    if (desktop) {
      e.preventDefault();
      desktop.openExternal(url);
    }
  };

  return <a href={url} onClick={handleClick} target="_blank">{children}</a>;
}
```

## Available IPC APIs

Already wired in the template:

| API | Description |
|---|---|
| `showOpenDialog(opts)` | Native file open dialog |
| `showSaveDialog(opts)` | Native file save dialog |
| `readFile(path)` | Read file from disk |
| `writeFile(path, data)` | Write file to disk |
| `showNotification(title, body)` | System notification |
| `minimize()` | Minimize window |
| `maximize()` | Toggle maximize/unmaximize |
| `close()` | Close window |
| `onDeepLink(cb)` | Listen for deep link events |

## Common Native Features to Add

- **Auto-update:** Use `electron-updater` in main process, expose update status via IPC.
- **System tray:** Create `Tray` in main.ts, show/hide window on click.
- **Global shortcuts:** Register with `globalShortcut.register()` in main.ts.
- **Menu bar:** Build native menus with `Menu.buildFromTemplate()`.
- **Deep links:** Register protocol in main.ts, emit `deep-link` event to renderer.

## Building for Distribution

```bash
cd packages/desktop
bun run build       # Vite builds Electron main + preload
bun run dist        # Vite build, then package with electron-builder
```

Configure `electron-builder.json5` for app name, icons, and platform targets (DMG, NSIS, AppImage).

## Running

Desktop requires the server to be running first:

```bash
bun run dev &          # Start the server (API + web)
bun run dev:desktop    # Start electron
```

Or use two terminals — one for the server, one for desktop.
