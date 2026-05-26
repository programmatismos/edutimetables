# EduTimetables Desktop Fix — v1.0.4

## STATUS: READY TO TAG

## Changes Made
1. `packages/web/vite.config.ts` — added `base: "./"` → relative asset paths
2. `packages/desktop/electron/main.ts` — complete rewrite:
   - Embedded HTTP server (Node http) serving both static files + /api/*
   - DB seeded from resources to userData on first run
   - Window title fixed to "EduTimetables"
   - loadURL('http://127.0.0.1:PORT') instead of loadFile
3. `packages/desktop/electron/api-server.ts` — new entry point for esbuild
4. `packages/desktop/vite.config.ts` — cleaned up externals (api no longer imported here)
5. `packages/desktop/electron-builder.yml` — added asarUnpack, extraResources, native module files
6. `packages/desktop/package.json` — added libsql, @libsql/client to deps + version bump to 1.0.4
7. `.github/workflows/build-desktop.yml` — db:push step, copy seed db, install desktop deps, esbuild api-server.cjs

## Architecture
- esbuild bundles Hono API → dist-electron/api-server.cjs (libsql external)
- main.js imports api-server.cjs dynamically at runtime
- libsql native binary in node_modules (asarUnpack so .node file is accessible)
- seed local.db in extraResources → copied to userData on first launch
- HTTP server on random localhost port serves static + api
- Renderer loads http://127.0.0.1:PORT → /api/* routes to Hono, /* routes to web-dist

## Verified Locally
- [x] bun run build (web) — passes, uses ./assets/... paths
- [x] bun run build (desktop) — passes
- [x] esbuild api-server.cjs — 925KB bundle, exports honoApp.fetch

## Next
- git commit + push + tag v1.0.4
