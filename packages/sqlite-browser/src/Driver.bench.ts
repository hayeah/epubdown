import { bench, describe } from "vitest";
import { loadAsyncModuleUncached } from "./Driver";
import { SQLiteDB } from "./SQLiteDB";

describe("SQLite loading benchmarks", () => {
  bench("SQLiteDB.open (with caching)", async () => {
    const db = await SQLiteDB.open();
    await db.close();
  });

  bench("SQLiteDB.open with IndexedDB store", async () => {
    const db = await SQLiteDB.open("bench-test-store");
    await db.close();
  });

  bench("loadAsyncModuleUncached", async () => {
    await loadAsyncModuleUncached();
  });
});

describe("Batch insert benchmarks", () => {
  const ROW_COUNT = 1000;

  bench("Non-batch inserts (individual exec calls)", async () => {
    const db = await SQLiteDB.open();

    await db.exec(`
      CREATE TABLE bench_individual (
        id INTEGER PRIMARY KEY,
        name TEXT,
        value INTEGER,
        timestamp REAL
      )
    `);

    // Insert rows one by one
    for (let i = 0; i < ROW_COUNT; i++) {
      await db.exec(
        "INSERT INTO bench_individual (name, value, timestamp) VALUES (?, ?, ?)",
        [`Item ${i}`, i * 10, Date.now() + i],
      );
    }

    await db.close();
  });

  bench("Non-batch inserts in transaction", async () => {
    const db = await SQLiteDB.open();

    await db.exec(`
      CREATE TABLE bench_transaction (
        id INTEGER PRIMARY KEY,
        name TEXT,
        value INTEGER,
        timestamp REAL
      )
    `);

    // Insert rows in a transaction
    await db.transaction(async (tx) => {
      for (let i = 0; i < ROW_COUNT; i++) {
        await tx.exec(
          "INSERT INTO bench_transaction (name, value, timestamp) VALUES (?, ?, ?)",
          [`Item ${i}`, i * 10, Date.now() + i],
        );
      }
    });

    await db.close();
  });

  bench("Batch inserts with execBatch (auto-transaction)", async () => {
    const db = await SQLiteDB.open();

    await db.exec(`
      CREATE TABLE bench_batch (
        id INTEGER PRIMARY KEY,
        name TEXT,
        value INTEGER,
        timestamp REAL
      )
    `);

    // Prepare batch parameters
    const batchParams: unknown[][] = [];
    for (let i = 0; i < ROW_COUNT; i++) {
      batchParams.push([`Item ${i}`, i * 10, Date.now() + i]);
    }

    // Insert all rows with a single execBatch call (runs in transaction automatically)
    await db.execBatch(
      "INSERT INTO bench_batch (name, value, timestamp) VALUES (?, ?, ?)",
      batchParams,
    );

    await db.close();
  });
});
