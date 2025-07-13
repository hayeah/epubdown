import { bench, describe } from "vitest";
import { Driver, loadAsyncModuleUncached } from "./sqlite-database";

describe("SQLite loading benchmarks", () => {
  bench("Driver.open and open database (with caching)", async () => {
    const driver = await Driver.open();
    const db = await driver.open();
    await db.close();
    await driver.close();
  });

  bench("Driver.open with IndexedDB store", async () => {
    const driver = await Driver.open({ indexedDBStore: "bench-test-store" });
    const db = await driver.open();
    await db.close();
    await driver.close();
  });

  bench("loadAsyncModuleUncached", async () => {
    await loadAsyncModuleUncached();
  });
});
