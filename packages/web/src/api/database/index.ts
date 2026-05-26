/**
 * Database client — dual mode:
 *   • Electron production: better-sqlite3 (native, sync)
 *   • Web / Turso remote: @libsql/client (HTTP, async)
 */

import { createRequire } from "node:module";
import * as schema from "./schema";
import { initDb } from "./init";

const _require = typeof require !== "undefined" ? require : createRequire(import.meta.url);

let _db: any = null;
let _rawSqlite: any = null; // exposed for sync seed operations

function getDb() {
  if (_db) return _db;

  const sqlitePath = process.env.DATABASE_SQLITE_PATH;

  if (sqlitePath) {
    const Database = _require("better-sqlite3");
    const { drizzle } = _require("drizzle-orm/better-sqlite3");
    const sqlite = new Database(sqlitePath);
    sqlite.pragma("journal_mode = WAL");
    initDb(sqlite);
    _rawSqlite = sqlite;
    _db = drizzle(sqlite, { schema });
  } else {
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

export function getRawSqlite(): any | null {
  getDb(); // ensure initialized
  return _rawSqlite;
}

export const db = new Proxy({} as any, {
  get(_t, prop) {
    return (getDb() as any)[prop];
  },
});
