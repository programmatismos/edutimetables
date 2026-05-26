import { defineConfig } from "vite";
import path from "node:path";
import electron from "vite-plugin-electron/simple";

export default defineConfig({
  build: {
    rollupOptions: {
      input: path.join(__dirname, "electron/no-renderer.ts"),
    },
  },
  plugins: [
    electron({
      main: {
        entry: "electron/main.ts",
        vite: {
          build: {
            rollupOptions: {
              external: [
                "electron",
                "electron-updater",
                // Node built-ins
                "node:path", "node:fs", "node:fs/promises", "node:http",
                "node:url", "node:child_process", "node:net", "node:os",
                "node:buffer", "node:stream", "node:events", "node:util",
                "path", "fs", "http", "url", "child_process", "net", "os",
                "buffer", "stream", "events", "util", "crypto", "module",
              ],
            },
          },
        },
      },
      preload: {
        input: path.join(__dirname, "electron/preload.ts"),
      },
    }),
  ],
  server: {
    allowedHosts: true,
  },
});
