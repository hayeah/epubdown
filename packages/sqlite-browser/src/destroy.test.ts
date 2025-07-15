import { describe, expect, it } from "vitest";
import { Driver, SQLiteDB, destroy } from "./";
import { indexedDBExists } from "./indexeddb-helpers";

describe("destroy function", () => {
  it("should destroy Driver and remove IndexedDB store", async () => {
    const databaseName = `test-destroy-driver-${Date.now()}`;
    const driver = await Driver.open(databaseName);

    // Create a database to ensure IndexedDB store is created
    const handle = driver.handle;
    await driver.sqlite3.exec(handle, "CREATE TABLE test (id INTEGER)");

    // Verify the IndexedDB store exists
    const storeName = driver.indexedDBStore;
    expect(storeName).toBe(`sqlite://${databaseName}`);
    expect(storeName).not.toBeNull();
    if (!storeName) throw new Error("Expected indexedDBStore to be defined");
    expect(await indexedDBExists(storeName)).toBe(true);

    // Destroy the driver
    await destroy(driver);

    // Verify the store has been deleted
    expect(await indexedDBExists(storeName)).toBe(false);

    // Verify we can't use the driver anymore
    await expect(driver.sqlite3.exec(handle, "SELECT 1")).rejects.toThrow();
  });

  it("should destroy SQLiteDB and remove IndexedDB store", async () => {
    const databaseName = `test-destroy-db-${Date.now()}`;
    const db = await SQLiteDB.open(databaseName);

    // Create a table to ensure IndexedDB store is created
    await db.exec("CREATE TABLE test (id INTEGER)");

    // Verify the IndexedDB store exists
    const storeName = db.indexedDBStore;
    expect(storeName).toBe(`sqlite://${databaseName}`);
    expect(storeName).not.toBeNull();
    if (!storeName) throw new Error("Expected indexedDBStore to be defined");
    expect(await indexedDBExists(storeName)).toBe(true);

    // Destroy the database
    await destroy(db);

    // Verify the store has been deleted
    expect(await indexedDBExists(storeName)).toBe(false);

    // Verify we can't use the database anymore
    await expect(db.exec("SELECT 1")).rejects.toThrow();
  });

  it("should handle in-memory databases without error", async () => {
    // Test with Driver
    const driver = await Driver.open();
    expect(driver.indexedDBStore).toBeNull();
    await expect(destroy(driver)).resolves.not.toThrow();

    // Test with SQLiteDB
    const db = await SQLiteDB.open();
    expect(db.indexedDBStore).toBeNull();
    await expect(destroy(db)).resolves.not.toThrow();
  });
});
