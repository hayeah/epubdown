import * as SQLite from "wa-sqlite";
import { Driver } from "./Driver";
import type { SQLLikeDB } from "./migrator";

export class SQLiteDB implements SQLLikeDB {
  /** promise we chain every call onto */
  private queue: Promise<unknown> = Promise.resolve();
  /** when false, public methods run immediately (used inside a txn) */
  private readonly useQueue: boolean;

  constructor(
    readonly driver: Driver,
    useQueue = true,
  ) {
    this.useQueue = useQueue;
  }

  get db(): number {
    return this.driver.handle;
  }

  get sqlite3(): ReturnType<typeof SQLite.Factory> {
    return this.driver.sqlite3;
  }

  get vfs(): any | null {
    return this.driver.vfs;
  }

  get indexedDBStore(): string | null {
    return this.driver.indexedDBStore;
  }

  static async open(databaseName = ":memory:"): Promise<SQLiteDB> {
    const driver = await Driver.open(databaseName);
    return new SQLiteDB(driver);
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

  /**
   * Execute a prepared statement with the given parameters.
   * @param sql - The SQL statement to execute
   * @param params - Parameters to bind to the statement
   * @param onRow - Optional callback to process each row (for query)
   */
  private async executePrepared(
    sql: string,
    params: unknown[],
    onRow?: (stmt: number) => void,
  ): Promise<void> {
    for await (const stmt of this.sqlite3.statements(this.db, sql)) {
      if (params.length) {
        this.sqlite3.bind_collection(stmt, params);
      }

      // always run exactly one step
      let rc = await this.sqlite3.step(stmt);

      if (!onRow) {
        // no row callback.
        // automatic finalise when SQLITE_DONE reached
        continue;
      }

      // user wants rows
      if (rc === SQLite.SQLITE_ROW) {
        onRow(stmt);
      }

      while (rc !== SQLite.SQLITE_DONE) {
        rc = await this.sqlite3.step(stmt);
        if (rc === SQLite.SQLITE_ROW) {
          onRow(stmt);
        }
      }
      // automatic finalise when SQLITE_DONE reached
    }
  }
  /** raw exec without queuing (only call from runExclusive) */
  private async execRaw(sql: string, params: unknown[] = []): Promise<void> {
    if (params.length === 0) {
      // Use simple exec for statements without parameters
      await this.sqlite3.exec(this.db, sql);
    } else {
      // Use prepared statements for parameterized queries
      await this.executePrepared(sql, params);
    }
  }

  async exec(sql: string, params: unknown[] = []): Promise<void> {
    return this.runExclusive(() => this.execRaw(sql, params));
  }

  async query<R = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<{ rows: R[] }> {
    return this.runExclusive(async () => {
      const rows: R[] = [];

      await this.executePrepared(sql, params, (stmt) => {
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
      });

      return { rows };
    });
  }

  /**
   * Execute a database transaction with automatic BEGIN/COMMIT/ROLLBACK handling.
   *
   * ## How useQueue works
   *
   * `useQueue` is the on/off switch for the **promise-chain that serialises every call**
   * to `exec`, `query`, or `transaction`:
   *
   * - When **true** (default) → each public method attaches its work to `this.queue`,
   *   so any concurrent callers line up one-after-another
   * - When **false** → the method runs immediately, trusting the surrounding code
   *   to have already guaranteed exclusivity
   *
   * ## Transaction implementation
   *
   * The library turns useQueue *off* only inside the implementation of `transaction`:
   *
   * 1. `transaction()` itself acquires the queue's lock with `runExclusive` and issues `BEGIN`
   * 2. It creates a **child** wrapper with `useQueue = false` and hands that to the user's callback
   *    - All statements executed through this child run straight away, because the outer
   *      `transaction()` is *already* holding the lock
   *    - This avoids building a second, pointless promise chain and keeps the whole
   *      `BEGIN … COMMIT` block truly atomic
   *
   * ## Why not leave it always true?
   *
   * - If inner statements re-queued themselves they would be scheduled **after** the outer
   *   `transaction()` finishes (their promises would attach to a *new* queue tail) – they
   *   would run *outside* the open transaction and the `COMMIT` would happen first
   * - Even if you reused the same queue, constantly re-queuing inside tight loops would
   *   add noticeable overhead and memory pressure
   * - Turning it off only while already under the lock preserves correctness and improves
   *   performance without sacrificing safety
   *
   * ## Usage
   *
   * In practice you never toggle `useQueue` yourself; simply call:
   *
   * ```ts
   * await db.transaction(async (tx) => {
   *   await tx.exec("INSERT …");
   *   await tx.query("SELECT …");
   * });
   * ```
   *
   * The wrapper handles the switch for you. Everywhere else the queue should remain
   * enabled so that independent calls on the same `SQLiteDB` instance stay serialized.
   */
  async transaction<T>(fn: (tx: SQLiteDB) => Promise<T>): Promise<T> {
    return this.runExclusive(async () => {
      await this.execRaw("BEGIN");
      try {
        // Create child wrapper with useQueue=false since we already hold the exclusive lock
        const txWrapper = new SQLiteDB(this.driver, false);
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
      await this.driver.close();
    });
  }
}
