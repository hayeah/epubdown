import SQLiteESMFactory from "wa-sqlite/dist/wa-sqlite-async.mjs";
import { IDBBatchAtomicVFS } from "wa-sqlite/src/examples/IDBBatchAtomicVFS.js";
import * as SQLite from "wa-sqlite";

import { Migrator, type Migration, type SQLLikeDB } from "../db/Migrator";

export interface SQLLikeDB {
  exec(sql: string): Promise<void>;
  query<R = unknown>(sql: string, params?: unknown[]): Promise<{ rows: R[] }>;
}

// NOTE: this is example code extracted from another code base, you need to refactor it
async function initSqliteDB() {
  // const module = await WebAssembly.instantiateStreaming(fetch(wasmUrl), imports)
  let esmLoadConfig: any;
  if (process.env.NODE_ENV === "test") {
    // const wasmPath = resolve(
    //   dirname(fileURLToPath(import.meta.url)),
    //   "../../../node_modules/wa-sqlite/dist/wa-sqlite-async.wasm",
    // )
    const { readFile } = await import("fs/promises");
    const wasmPath = require.resolve("wa-sqlite/dist/wa-sqlite-async.wasm");
    const wasmBinary = await readFile(wasmPath);

    esmLoadConfig = {
      wasmBinary,
    };
  } else {
    let wasmUrl: string = (
      await import("wa-sqlite/dist/wa-sqlite-async.wasm?url")
    ).default;

    esmLoadConfig = {
      locateFile: () => wasmUrl,
    };
  }

  const module = await SQLiteESMFactory(esmLoadConfig);

  // create the high-level API wrapper
  const sqlite3 = SQLite.Factory(module);

  if (process.env.NODE_ENV != "test") {
    // build and register the IndexedDB-backed VFS
    const vfs = await IDBBatchAtomicVFS.create("epub-store", module, {
      // lockPolicy: "shared+hint",
    });
    sqlite3.vfs_register(vfs, true); // true ⇒ make it the default FS
  }

  // open (or create) the database via the convenience helper
  const dbHandle = await sqlite3.open_v2("epub.db");
  const db = new SQLiteDBWrapper(sqlite3, dbHandle);

  return db;

  // how it might be used
  //   const store = new EpubSQLiteStore(db);
  //   const migrator = new Migrator(db);
  //   await migrator.up(MIGRATIONS);
}

export class SQLiteDBWrapper implements SQLLikeDB {
  /** promise we chain every call onto */
  private queue: Promise<unknown> = Promise.resolve();
  /** when false, public methods run immediately (used inside a txn) */
  private readonly useQueue: boolean;

  constructor(
    private readonly sqlite3: ReturnType<typeof SQLite.Factory>,
    private readonly db: number,
    useQueue = true
  ) {
    this.useQueue = useQueue;
  }

  private static toPositional(sql: string): string {
    // convert $1, $2 … -> ? so we can use array-binding
    return sql.replace(/\$\d+/g, "?");
  }

  /** run fn exclusively, queuing when needed */
  private runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.useQueue) {
      // already inside an exclusive section (e.g. a transaction)
      return fn();
    }

    // chain onto the tail of the queue
    const task = this.queue.then(fn);
    // keep the chain alive even if task rejects
    this.queue = task.catch(() => undefined);
    return task;
  }

  /** raw exec without queuing (only call from runExclusive) */
  private async execRaw(sql: string): Promise<void> {
    await this.sqlite3.exec(this.db, SQLiteDBWrapper.toPositional(sql));
  }

  async exec(sql: string): Promise<void> {
    return this.runExclusive(() => this.execRaw(sql));
  }

  async query<R = Record<string, unknown>>(
    sql: string,
    params: unknown[] = []
  ): Promise<{ rows: R[] }> {
    return this.runExclusive(async () => {
      const rows: R[] = [];
      const positional = SQLiteDBWrapper.toPositional(sql);

      for await (const stmt of this.sqlite3.statements(this.db, positional)) {
        if (params.length) {
          this.sqlite3.bind_collection(stmt, params as unknown[]);
        }

        while ((await this.sqlite3.step(stmt)) === SQLite.SQLITE_ROW) {
          const colCount = this.sqlite3.column_count(stmt);
          const row: Record<string, unknown> = {};

          for (let i = 0; i < colCount; i++) {
            const name = this.sqlite3.column_name(stmt, i);
            row[name] = this.sqlite3.column(stmt, i);
          }
          rows.push(row as R);
        }
      }
      return { rows };
    });
  }

  async transaction<T>(fn: (tx: SQLiteDBWrapper) => Promise<T>): Promise<T> {
    return this.runExclusive(async () => {
      await this.execRaw("BEGIN");
      try {
        // inner wrapper skips the queue, staying inside this BEGIN…COMMIT pair
        const txWrapper = new SQLiteDBWrapper(this.sqlite3, this.db, false);
        const result = await fn(txWrapper);
        await this.execRaw("COMMIT");
        return result;
      } catch (err) {
        await this.execRaw("ROLLBACK");
        throw err;
      }
    });
  }
}
