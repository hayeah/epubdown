import * as SQLite from "wa-sqlite";
import SQLiteESMFactory from "wa-sqlite/dist/wa-sqlite-async.mjs";
import { IDBBatchAtomicVFS } from "wa-sqlite/src/examples/IDBBatchAtomicVFS.js";
import { SQLiteDB } from "./SQLiteDB";

export class Driver {
  constructor(
    public readonly sqlite3: ReturnType<typeof SQLite.Factory>,
    public readonly module: any,
    public readonly vfs: any
  ) {}

  async close(): Promise<void> {
    if (this.vfs) {
      await this.vfs.close();
    }
  }

  async openHandle(databaseName: string): Promise<number> {
    return await this.sqlite3.open_v2(databaseName);
  }

  async open(databaseName = ":memory:"): Promise<SQLiteDB> {
    const dbHandle = await this.openHandle(databaseName);
    return new SQLiteDB(this.sqlite3, dbHandle);
  }

  static async open(
    options: { indexedDBStore?: string } = {}
  ): Promise<Driver> {
    const module = await loadAsyncModule();
    const sqlite3 = SQLite.Factory(module);

    let vfs: any;
    if (options.indexedDBStore) {
      // Register IndexedDB-backed VFS for persistence
      vfs = await IDBBatchAtomicVFS.create(options.indexedDBStore, module);
      sqlite3.vfs_register(vfs, true);
    }

    return new Driver(sqlite3, module, vfs);
  }
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

// Export for benchmarking
export { loadAsyncModuleUncached };
