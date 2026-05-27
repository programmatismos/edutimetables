/**
 * Database client — dual mode:
 *   • Electron production: better-sqlite3 (native, sync) loaded from asar.unpacked
 *   • Web / Turso remote: @libsql/client (HTTP, async)
 *
 * drizzle-orm/better-sqlite3 is statically imported → bundled by esbuild.
 * drizzle-orm/libsql and @libsql/client are kept external (native binary deps)
 * and only loaded dynamically in the web/Turso path.
 */

import path from "node:path";
import * as schema from "./schema";
import { initDb } from "./init";

// Statically imported → esbuild bundles this (pure JS, no native dep)
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";

// esbuild outputs CJS — require() is always available in that context
declare const require: NodeRequire;
const _require = require;

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
    // Electron path — better-sqlite3 is native, loaded from unpacked asar.
    // Pass nativeBinding directly to avoid the 'bindings' module resolver
    // which fails inside asar (it uses V8 stack inspection to find module_root).
    const modulesPath = process.env.ELECTRON_MODULES_PATH;
    const Database = requireNative("better-sqlite3");
    const nativeBindingOpts = modulesPath
      ? { nativeBinding: path.join(modulesPath, "better-sqlite3", "build", "Release", "better_sqlite3.node") }
      : {};
    const sqlite = new Database(sqlitePath, nativeBindingOpts);
    sqlite.pragma("journal_mode = WAL");
    initDb(sqlite);
    _rawSqlite = sqlite;
    _db = drizzleSqlite(sqlite, { schema });
  } else {
    // Web / Turso path — kept external, loaded at runtime only
    const { createClient } = _require("@libsql/client");
    const { drizzle: drizzleLibsql } = _require("drizzle-orm/libsql");
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
