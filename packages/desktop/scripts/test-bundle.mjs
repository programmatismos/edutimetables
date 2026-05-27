/**
 * test-bundle.mjs
 * Runs after esbuild produces dist-electron/api-server.cjs.
 * Simulates Electron runtime: sets ELECTRON_MODULES_PATH + DATABASE_SQLITE_PATH,
 * loads the bundle, and hits critical endpoints.
 *
 * Exit 0 = all tests pass. Exit 1 = failure.
 */

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const DESKTOP = path.resolve(__dirname, "..");

// ── Paths ─────────────────────────────────────────────────────────────────────
const BUNDLE     = path.join(DESKTOP, "dist-electron", "api-server.cjs");
const DB_PATH    = path.join(ROOT, "packages/web/local.db");
// better-sqlite3: look in desktop/node_modules (copied there in CI)
const UNPACKED   = path.join(DESKTOP, "node_modules");
// drizzle-orm: look in web/node_modules
const DRIZZLE    = path.join(ROOT, "packages/web/node_modules");

// ── Guards ────────────────────────────────────────────────────────────────────
if (!fs.existsSync(BUNDLE)) {
  console.error("FAIL: bundle not found at", BUNDLE);
  process.exit(1);
}
if (!fs.existsSync(DB_PATH)) {
  console.error("FAIL: local.db not found at", DB_PATH);
  process.exit(1);
}

// ── Simulate Electron env ─────────────────────────────────────────────────────
process.env.DATABASE_SQLITE_PATH = DB_PATH;
process.env.ELECTRON_MODULES_PATH = UNPACKED;

// Patch require so drizzle-orm resolves from web/node_modules
// (in production it's packed into asar, here we simulate that)
const _require2 = createRequire(import.meta.url);
const Module = _require2("module");
const _orig = Module._load.bind(Module);
Module._load = function (request, parent, isMain) {
  if (request.startsWith("drizzle-orm")) {
    const resolved = path.join(DRIZZLE, request);
    return _orig(resolved, parent, isMain);
  }
  return _orig(request, parent, isMain);
};

// ── Load bundle ───────────────────────────────────────────────────────────────
const _require = createRequire(import.meta.url);
let honoApp;
try {
  const mod = _require(BUNDLE);
  honoApp = mod?.default ?? mod;
} catch (e) {
  console.error("FAIL: bundle load threw:", e.message);
  process.exit(1);
}

if (typeof honoApp?.fetch !== "function") {
  console.error("FAIL: honoApp.fetch is not a function. Keys:", Object.keys(honoApp ?? {}));
  process.exit(1);
}
console.log("PASS: bundle loaded, honoApp.fetch is a function");

// ── Endpoint tests ────────────────────────────────────────────────────────────
async function hit(method, url, label) {
  const res = await honoApp.fetch(new Request("http://localhost" + url, { method }));
  const body = await res.text();
  if (res.status >= 500) {
    console.error(`FAIL [${label}]: ${res.status} ${body.slice(0, 200)}`);
    return false;
  }
  console.log(`PASS [${label}]: ${res.status}`);
  return true;
}

const results = await Promise.all([
  hit("GET",  "/api/school",   "GET /api/school"),
  hit("GET",  "/api/teachers", "GET /api/teachers"),
  hit("GET",  "/api/classes",  "GET /api/classes"),
  hit("GET",  "/api/subjects", "GET /api/subjects"),
  hit("POST", "/api/reset",    "POST /api/reset"),
]);

if (results.some(r => !r)) {
  console.error("\n❌ Some tests FAILED");
  process.exit(1);
}

console.log("\n✅ All tests passed");
