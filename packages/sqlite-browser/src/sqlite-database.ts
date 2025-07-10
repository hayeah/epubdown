import * as SQLite from "wa-sqlite";
import SQLiteESMFactory from "wa-sqlite/dist/wa-sqlite-async.mjs";
import { IDBBatchAtomicVFS } from "wa-sqlite/src/examples/IDBBatchAtomicVFS.js";
import { SQLiteDBWrapper } from "./sqlite-wrapper";

export interface SqliteDatabaseOptions {
  /**
   * Name of the database file
   * @default "database.db"
   */
  databaseName?: string;

  /**
   * Name of the IndexedDB store for persistence
   * @default "sqlite-store"
   */
  storeName?: string;

  /**
   * Whether to use IndexedDB for persistence
   * @default true (false in test environment)
   */
  useIndexedDB?: boolean;

  /**
   * Custom WASM binary or URL
   */
  wasmBinary?: ArrayBuffer;
  wasmUrl?: string;
}

export interface SQLiteDatabase {
  db: SQLiteDBWrapper;
  close: () => Promise<void>;
}

/**
 * Creates a SQLite database instance for browser usage with optional IndexedDB persistence
 */
export async function createSqliteDatabase(
  options: SqliteDatabaseOptions = {},
): Promise<SQLiteDatabase> {
  const {
    databaseName = "database.db",
    storeName = "sqlite-store",
    useIndexedDB = typeof process !== "undefined" &&
      process.env?.NODE_ENV !== "test",
    wasmBinary,
    wasmUrl,
  } = options;

  let esmLoadConfig: any;

  if (wasmBinary) {
    esmLoadConfig = { wasmBinary };
  } else if (wasmUrl) {
    esmLoadConfig = {
      locateFile: () => wasmUrl,
    };
  } else if (
    typeof process !== "undefined" &&
    process.env?.NODE_ENV === "test"
  ) {
    // In test environment, try to load from node_modules
    try {
      // Dynamic import for Node.js environment only
      const fs = await import("node:fs/promises").catch(() => null);
      if (fs && typeof require !== "undefined") {
        const wasmPath = require.resolve("wa-sqlite/dist/wa-sqlite-async.wasm");
        const binary = await fs.readFile(wasmPath);
        esmLoadConfig = { wasmBinary: binary };
      } else {
        esmLoadConfig = {};
      }
    } catch (e) {
      // Fallback to default loading
      esmLoadConfig = {};
    }
  } else {
    // In browser, use dynamic import with Vite's ?url suffix
    try {
      const url: string = (
        await import("wa-sqlite/dist/wa-sqlite-async.wasm?url")
      ).default;
      esmLoadConfig = {
        locateFile: () => url,
      };
    } catch (e) {
      // Fallback to default loading
      esmLoadConfig = {};
    }
  }

  const module = await SQLiteESMFactory(esmLoadConfig);
  const sqlite3 = SQLite.Factory(module);

  if (useIndexedDB) {
    // Register IndexedDB-backed VFS for persistence
    const vfs = await IDBBatchAtomicVFS.create(storeName, module);
    sqlite3.vfs_register(vfs, true);
  }

  const dbHandle = await sqlite3.open_v2(databaseName);
  const db = new SQLiteDBWrapper(sqlite3, dbHandle);

  return {
    db,
    close: async () => {
      await sqlite3.close(dbHandle);
    },
  };
}
