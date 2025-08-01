import * as SQLite from "wa-sqlite";
import SQLiteESMFactory from "wa-sqlite/dist/wa-sqlite-async.mjs";
import { IDBBatchAtomicVFS } from "wa-sqlite/src/examples/IDBBatchAtomicVFS.js";
import { SQLiteDB } from "./SQLiteDB";

export class Driver {
  constructor(
    public readonly sqlite3: ReturnType<typeof SQLite.Factory>,
    public readonly module: any,
    public readonly vfs: any | null,
    public readonly handle: number,
    private readonly databaseName: string,
  ) {}

  get indexedDBStore(): string | null {
    if (this.vfs && this.databaseName !== ":memory:") {
      return `sqlite://${this.databaseName}`;
    }
    return null;
  }

  async close(): Promise<void> {
    await this.sqlite3.close(this.handle);
    if (this.vfs) {
      await this.vfs.close();
    }
  }

  static async open(databaseName = ":memory:"): Promise<Driver> {
    const module = await loadAsyncModule();
    const sqlite3 = SQLite.Factory(module);

    let vfs: any | null = null;
    if (databaseName !== ":memory:") {
      // Register IndexedDB-backed VFS for persistence
      // There is a 1:1 mapping between SQLite databases and IndexedDB stores:
      // Each SQLite database (except :memory:) gets its own IndexedDB store
      // with the naming scheme: sqlite://{databaseName}
      const storeName = `sqlite://${databaseName}`;
      vfs = await IDBBatchAtomicVFS.create(storeName, module);
      sqlite3.vfs_register(vfs, true);
    }

    const handle = await sqlite3.open_v2(databaseName);
    return new Driver(sqlite3, module, vfs, handle, databaseName);
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
