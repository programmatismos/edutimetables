/**
 * Database client — dual mode:
 *   • Electron production: better-sqlite3 (native, no asar issues, synchronous)
 *   • Web / Turso remote: @libsql/client (HTTP)
 *
 * We detect Electron by the presence of DATABASE_SQLITE_PATH env var,
 * which main.ts sets before importing api-server.cjs.
 */

import { createRequire } from "node:module";
import * as schema from "./schema";
import { initDb } from "./init";

// createRequire works in both CJS (Electron bundle) and ESM (Vite SSR dev)
const _require = typeof require !== "undefined" ? require : createRequire(import.meta.url);

// Lazy singleton
let _db: any = null;

function getDb() {
  if (_db) return _db;

  const sqlitePath = process.env.DATABASE_SQLITE_PATH;

  if (sqlitePath) {
    // ── Electron: better-sqlite3 (pure sync, no native module loader issues)
    const Database = _require("better-sqlite3");
    const { drizzle } = _require("drizzle-orm/better-sqlite3");
    const sqlite = new Database(sqlitePath);
    // WAL mode for better concurrent read performance
    sqlite.pragma("journal_mode = WAL");
    // Create tables if they don't exist (first run)
    initDb(sqlite);
    _db = drizzle(sqlite, { schema });
  } else {
    // ── Web / dev / remote Turso
    const { createClient } = _require("@libsql/client");
    const { drizzle } = _require("drizzle-orm/libsql");
    const client = createClient({
      url: process.env.DATABASE_URL!,
      authToken: process.env.DATABASE_AUTH_TOKEN,
    });
    _db = drizzle(client, { schema });
  }

  return _db;
}

// Proxy so all existing `db.xxx` call sites keep working without changes
export const db = new Proxy({} as any, {
  get(_t, prop) {
    return (getDb() as any)[prop];
  },
});
