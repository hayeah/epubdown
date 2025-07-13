import * as SQLite from "wa-sqlite";
import type { SQLLikeDB } from "./migrator";

export class SQLiteDBWrapper implements SQLLikeDB {
  /** promise we chain every call onto */
  private queue: Promise<unknown> = Promise.resolve();
  /** when false, public methods run immediately (used inside a txn) */
  private readonly useQueue: boolean;

  constructor(
    private readonly sqlite3: ReturnType<typeof SQLite.Factory>,
    private readonly db: number,
    useQueue = true,
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
    params: unknown[] = [],
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

  async close(): Promise<void> {
    return this.runExclusive(async () => {
      await this.sqlite3.close(this.db);
    });
  }
}
