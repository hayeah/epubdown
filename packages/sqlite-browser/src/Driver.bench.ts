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
