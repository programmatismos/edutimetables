/**
 * API server entry point.
 * Exports the Hono app instance so it can be used inline in main.ts
 * to create an HTTP server.
 *
 * Built to dist-electron/api-server.cjs by the workflow's esbuild step.
 * All JS deps (hono, drizzle-orm, @libsql/client JS layer) are bundled.
 * The native `libsql` binary (.node) is marked external and loaded from
 * process.resourcesPath at runtime.
 */
export { default } from "../../web/src/api/index";
