/**
 * Database client — dual mode:
 *   • Electron production: better-sqlite3 (native, sync) loaded from asar.unpacked
 *   • Web / Turso remote: @libsql/client (HTTP, async)
 *
 * drizzle-orm adapters are statically imported so esbuild bundles them into
 * api-server.cjs — no runtime module resolution needed.
 */

import { createRequire } from "node:module";
import path from "node:path";
import * as schema from "./schema";
import { initDb } from "./init";

// Static imports — bundled by esbuild into api-server.cjs
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import { drizzle as drizzleLibsql } from "drizzle-orm/libsql";

const _require = typeof require !== "undefined" ? require : createRequire(import.meta.url);

let _db: any = null;
let _rawSqlite: any = null; // exposed for sync seed operations

function requireNative(name: string) {
  // Native modules (.node binaries) must be loaded from app.asar.unpacked.
  const modulesPath = process.env.ELECTRON_MODULES_PATH;
  if (modulesPath) {
    return _require(path.join(modulesPath, name));
  }
  return _require(name);
}

function getDb() {
  if (_db) return _db;

  const sqlitePath = process.env.DATABASE_SQLITE_PATH;

  if (sqlitePath) {
    const Database = requireNative("better-sqlite3");
    const sqlite = new Database(sqlitePath);
    sqlite.pragma("journal_mode = WAL");
    initDb(sqlite);
    _rawSqlite = sqlite;
    _db = drizzleSqlite(sqlite, { schema });
  } else {
    const { createClient } = _require("@libsql/client");
    const client = createClient({
      url: process.env.DATABASE_URL!,
      authToken: process.env.DATABASE_AUTH_TOKEN,
    });
    _db = drizzleLibsql(client, { schema });
  }

  return _db;
}

export function getRawSqlite(): any | null {
  getDb(); // ensure initialized
  return _rawSqlite;
}

export const db = new Proxy({} as any, {
  get(_t, prop) {
    return (getDb() as any)[prop];
  },
});
