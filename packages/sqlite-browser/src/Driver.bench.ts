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

describe("SQLite export benchmarks", () => {
  bench("SQLiteDB.exportBinary", async () => {
    const db = await SQLiteDB.open();

    // Create a moderately sized database for benchmarking
    await db.exec(`
      CREATE TABLE benchmark (
        id INTEGER PRIMARY KEY,
        data TEXT,
        value REAL,
        blob BLOB
      )
    `);

    // Insert 1000 rows
    await db.transaction(async (tx) => {
      for (let i = 0; i < 1000; i++) {
        await tx.exec(
          "INSERT INTO benchmark (data, value, blob) VALUES (?, ?, ?)",
          [`Row ${i}`, Math.random() * 1000, new Uint8Array(100).fill(i % 256)],
        );
      }
    });

    // Benchmark the export
    await db.exportBinary();

    await db.close();
  });
});
