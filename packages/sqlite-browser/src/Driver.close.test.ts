import { describe, expect, it } from "vitest";
import { SQLiteDB } from "./";
import { deleteIndexedDB, indexedDBExists } from "./indexeddb-helpers";

describe("SQLite Database - Browser Tests", () => {
  describe("close method", () => {
    it("should not allow IndexedDB deletion while connection is open", async () => {
      const databaseName = `test-db-${Date.now()}`;
      const indexedDBStore = `sqlite://${databaseName}`;

      const db = await SQLiteDB.open(databaseName);

      // Create a table to ensure the database is actually created
      await db.exec("CREATE TABLE test (id INTEGER)");

      // Verify the IndexedDB store exists
      expect(await indexedDBExists(indexedDBStore)).toBe(true);

      // Try to delete the IndexedDB store while connection is open
      // This should throw an error because the connection is still open
      await expect(deleteIndexedDB(indexedDBStore)).rejects.toThrow(
        /Database deletion blocked.*has open connections/,
      );

      // Verify the store still exists
      expect(await indexedDBExists(indexedDBStore)).toBe(true);

      // Clean up
      await db.close();
    });

    it("should allow IndexedDB deletion after connection is closed", async () => {
      const databaseName = `test-db-${Date.now()}-closed`;
      const indexedDBStore = `sqlite://${databaseName}`;

      const db = await SQLiteDB.open(databaseName);

      // Create a table to ensure the database is actually created
      await db.exec("CREATE TABLE test (id INTEGER)");

      // Verify the IndexedDB store exists
      expect(await indexedDBExists(indexedDBStore)).toBe(true);

      // Close the database connection
      await db.close();

      // Now try to delete the IndexedDB store
      // This should succeed without throwing
      await expect(deleteIndexedDB(indexedDBStore)).resolves.toBeUndefined();

      // Verify the store has been deleted
      expect(await indexedDBExists(indexedDBStore)).toBe(false);
    });
  });
});
