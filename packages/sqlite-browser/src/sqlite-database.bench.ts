import { bench, describe } from "vitest";
import { loadAsyncModuleUncached, loadSqlite } from "./sqlite-database";

describe("SQLite loading benchmarks", () => {
  bench("loadSqlite (with caching)", async () => {
    await loadSqlite();
  });

  bench("loadSqlite with IndexedDB store", async () => {
    await loadSqlite({ indexedDBStore: "bench-test-store" });
  });

  bench("loadAsyncModuleUncached", async () => {
    await loadAsyncModuleUncached();
  });
});
