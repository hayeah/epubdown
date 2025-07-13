import { describe, expect, it } from "vitest";
import { createSqliteDatabase } from "./";

describe("SQLite Database - Browser Tests", () => {
  describe("close method", () => {
    it("should properly close the database connection", async () => {
      const dbName = `test-db-${Date.now()}`;
      const db = await createSqliteDatabase({
        databaseName: dbName,
        indexedDBStore: "test-store",
      });

      expect(db).toBeDefined();
      expect(db.db).toBeDefined();
      expect(db.close).toBeDefined();

      // Database should be usable before closing
      await db.db.exec("CREATE TABLE test (id INTEGER)");
      const result = await db.db.query(
        "SELECT name FROM sqlite_master WHERE type='table'",
      );
      expect(result.rows.length).toBeGreaterThan(0);

      // Close the database
      await db.close();

      // After closing, operations should fail
      await expect(
        db.db.exec("CREATE TABLE test2 (id INTEGER)"),
      ).rejects.toThrow();
    });

    it("should handle IndexedDB deletion while connection is open", async () => {
      const dbName = `test-db-${Date.now()}-2`;
      const db = await createSqliteDatabase({
        databaseName: dbName,
        indexedDBStore: "test-store",
      });

      expect(db).toBeDefined();

      // Create a table to ensure the database is actually created
      await db.db.exec("CREATE TABLE test (id INTEGER)");

      // Try to delete the database while it's still open
      const deleteRequest = indexedDB.deleteDatabase(dbName);

      let deleteCompleted = false;
      let deleteError: Error | null = null;

      const deletePromise = new Promise<void>((resolve) => {
        deleteRequest.onsuccess = () => {
          deleteCompleted = true;
          resolve();
        };
        deleteRequest.onerror = () => {
          deleteError = deleteRequest.error;
          resolve();
        };
      });

      // Give some time for potential delete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Now close the database
      // await db.close();

      // Wait for delete operation to complete
      await deletePromise;

      // Check results
      expect(deleteCompleted).toBe(true);
      expect(deleteError).toBeNull();

      // Verify deletion
      const dbList = await indexedDB.databases();
      const exists = dbList.some((dbInfo) => dbInfo.name === dbName);
      expect(exists).toBe(false);
    });

    it("should allow IndexedDB deletion after connection is closed", async () => {
      const dbName = `test-db-${Date.now()}-3`;
      const db = await createSqliteDatabase({
        databaseName: dbName,
        indexedDBStore: "test-store",
      });

      expect(db).toBeDefined();

      // Create a table to ensure the database is actually created
      await db.db.exec("CREATE TABLE test (id INTEGER)");

      // Close the database
      await db.close();

      // Delete the database
      const deleteRequest = indexedDB.deleteDatabase(dbName);
      await new Promise<void>((resolve, reject) => {
        deleteRequest.onsuccess = () => resolve();
        deleteRequest.onerror = () => reject(deleteRequest.error);
      });

      // Verify deletion
      const dbList = await indexedDB.databases();
      const exists = dbList.some((dbInfo) => dbInfo.name === dbName);
      expect(exists).toBe(false);
    });
  });
});
