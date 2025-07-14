import * as SQLite from "wa-sqlite";
import { Driver } from "./Driver";
import type { SQLLikeDB } from "./Migrator";

export class SQLiteDB implements SQLLikeDB {
  /** promise we chain every call onto */
  private queue: Promise<unknown> = Promise.resolve();
  /** when false, public methods run immediately (used inside a txn) */
  private readonly useQueue: boolean;

  constructor(
    private readonly sqlite3: ReturnType<typeof SQLite.Factory>,
    private readonly db: number,
    useQueue = true,
    private readonly vfs: any | null = null,
    private readonly databaseName: string = ":memory:",
  ) {
    this.useQueue = useQueue;
  }

  get indexedDBStore(): string | null {
    if (this.vfs && this.databaseName !== ":memory:") {
      return `sqlite://${this.databaseName}`;
    }
    return null;
  }

  static async open(databaseName = ":memory:"): Promise<SQLiteDB> {
    const driver = await Driver.open(databaseName);
    return new SQLiteDB(
      driver.sqlite3,
      driver.handle,
      true,
      driver.vfs,
      databaseName,
    );
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
    await this.sqlite3.exec(this.db, SQLiteDB.toPositional(sql));
  }

  async exec(sql: string): Promise<void> {
    return this.runExclusive(() => this.execRaw(sql));
  }

  async query<R = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<{ rows: R[] }> {
    return this.runExclusive(async () => {
      const rows: R[] = [];
      const positional = SQLiteDB.toPositional(sql);

      for await (const stmt of this.sqlite3.statements(this.db, positional)) {
        if (params.length) {
          this.sqlite3.bind_collection(stmt, params as unknown[]);
        }

        while ((await this.sqlite3.step(stmt)) === SQLite.SQLITE_ROW) {
          const colCount = this.sqlite3.column_count(stmt);
          const row: Record<string, unknown> = {};

          for (let i = 0; i < colCount; i++) {
            const name = this.sqlite3.column_name(stmt, i);
            const value = this.sqlite3.column(stmt, i);
            // BLOB data returned by column() is a view into WASM memory that becomes
            // invalid after the next SQLite operation. We need to copy it.
            if (value instanceof Uint8Array) {
              row[name] = value.slice();
            } else {
              row[name] = value;
            }
          }
          rows.push(row as R);
        }
      }
      return { rows };
    });
  }

  async transaction<T>(fn: (tx: SQLiteDB) => Promise<T>): Promise<T> {
    return this.runExclusive(async () => {
      await this.execRaw("BEGIN");
      try {
        // inner wrapper skips the queue, staying inside this BEGIN…COMMIT pair
        const txWrapper = new SQLiteDB(
          this.sqlite3,
          this.db,
          false,
          this.vfs,
          this.databaseName,
        );
        const result = await fn(txWrapper);
        await this.execRaw("COMMIT");
        return result;
      } catch (err) {
        await this.execRaw("ROLLBACK");
        throw err;
      }
    });
  }

  async close(): Promise<void> {
    return this.runExclusive(async () => {
      await this.sqlite3.close(this.db);
      if (this.vfs) {
        await this.vfs.close();
      }
    });
  }
}
