import * as SQLite from "wa-sqlite";
import SQLiteESMFactory from "wa-sqlite/dist/wa-sqlite-async.mjs";
import { IDBBatchAtomicVFS } from "wa-sqlite/src/examples/IDBBatchAtomicVFS.js";
import { SQLiteDBWrapper } from "./sqlite-wrapper";

export interface SqliteDatabaseOptions {
  /**
   * Name of the database file
   * @default ":memory:"
   */
  databaseName?: string;

  /**
   * Name of the IndexedDB store for persistence
   * @default "sqlite-store"
   */
  indexedDBStore?: string;
}

export interface SQLiteDatabase {
  db: SQLiteDBWrapper;
  close: () => Promise<void>;
}

// Memoized module loading
let cachedModule: any = null;

/**
 * Load the SQLite WASM module with memoization
 */
async function loadAsyncModule() {
  if (cachedModule) {
    return cachedModule;
  }

  cachedModule = await loadAsyncModuleUncached();
  return cachedModule;
}

/**
 * Load the SQLite WASM module without caching
 */
async function loadAsyncModuleUncached() {
  let esmLoadConfig: any;

  if (typeof process !== "undefined" && process.env?.NODE_ENV === "test") {
    // In test environment, load from node_modules
    const fs = await import("node:fs/promises");
    const wasmPath = require.resolve("wa-sqlite/dist/wa-sqlite-async.wasm");
    const binary = await fs.readFile(wasmPath);
    esmLoadConfig = { wasmBinary: binary };
  } else {
    // In browser, use dynamic import with Vite's ?url suffix
    const url: string = (
      await import("wa-sqlite/dist/wa-sqlite-async.wasm?url")
    ).default;
    esmLoadConfig = {
      locateFile: () => url,
    };
  }

  return await SQLiteESMFactory(esmLoadConfig);
}

/**
 * Load SQLite with optional IndexedDB store
 */
async function loadSqlite(options: { indexedDBStore?: string } = {}) {
  const module = await loadAsyncModule();
  const sqlite3 = SQLite.Factory(module);

  if (options.indexedDBStore) {
    // Register IndexedDB-backed VFS for persistence
    const vfs = await IDBBatchAtomicVFS.create(options.indexedDBStore, module);
    sqlite3.vfs_register(vfs, true);
  }

  return { sqlite3, module };
}

/**
 * Creates a SQLite database instance for browser usage with optional IndexedDB persistence
 */
export async function createSqliteDatabase(
  options: SqliteDatabaseOptions = {},
): Promise<SQLiteDatabase> {
  const { databaseName = ":memory:", indexedDBStore } = options;

  const { sqlite3 } = await loadSqlite({ indexedDBStore });
  const dbHandle = await sqlite3.open_v2(databaseName);
  const db = new SQLiteDBWrapper(sqlite3, dbHandle);

  return {
    db,
    close: async () => {
      await sqlite3.close(dbHandle);
    },
  };
}

// Export for benchmarking
export { loadSqlite, loadAsyncModuleUncached };
