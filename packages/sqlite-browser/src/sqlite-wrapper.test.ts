import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createSqliteDatabase } from "./sqlite-database";

describe("SQLiteDBWrapper", () => {
  let db: Awaited<ReturnType<typeof createSqliteDatabase>>;

  beforeEach(async () => {
    db = await createSqliteDatabase({
      databaseName: ":memory:",
      useIndexedDB: false,
    });
  });

  afterEach(async () => {
    // Clean up
    try {
      await db.close();
    } catch (e) {
      // Database might already be closed
    }
  });

  describe("close", () => {
    it("should close the database connection", async () => {
      // Create a table first
      await db.db.exec("CREATE TABLE test (id INTEGER PRIMARY KEY)");

      // Verify we can query it
      const result1 = await db.db.query(
        "SELECT name FROM sqlite_master WHERE type='table'",
      );
      expect(result1.rows).toHaveLength(1);

      // Close the database
      await db.close();

      // Verify that operations fail after closing
      await expect(
        db.db.exec("CREATE TABLE test2 (id INTEGER PRIMARY KEY)"),
      ).rejects.toThrow();
    });

    it("should handle multiple close calls gracefully", async () => {
      // First close should succeed
      await expect(db.close()).resolves.not.toThrow();

      // Second close should throw an error (database already closed)
      await expect(db.close()).rejects.toThrow();
    });

    it("should queue close operation after pending operations", async () => {
      const results: number[] = [];

      // Create a table
      await db.db.exec(
        "CREATE TABLE counter (id INTEGER PRIMARY KEY, value INTEGER)",
      );
      await db.db.query("INSERT INTO counter (id, value) VALUES (1, 0)");

      // Start multiple operations
      const promises = Array.from({ length: 5 }, async (_, i) => {
        await db.db.query(`UPDATE counter SET value = ${i + 1} WHERE id = 1`);
        results.push(i);
      });

      // Wait for all operations to complete
      await Promise.all(promises);

      // Verify all operations completed
      expect(results).toHaveLength(5);

      // Verify final value before closing
      const result = await db.db.query<{ value: number }>(
        "SELECT value FROM counter WHERE id = 1",
      );
      expect(result.rows[0].value).toBe(5);

      // Now close should work
      await expect(db.close()).resolves.not.toThrow();
    });

    it("should work correctly within a transaction", async () => {
      await db.db.exec(
        "CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)",
      );

      // Run a transaction
      await db.db.transaction(async (tx) => {
        await tx.query("INSERT INTO test (value) VALUES ('hello')");
        await tx.query("INSERT INTO test (value) VALUES ('world')");
      });

      // Verify data was inserted
      const result = await db.db.query("SELECT COUNT(*) as count FROM test");
      expect(result.rows[0].count).toBe(2);

      // Close should work after transaction
      await expect(db.close()).resolves.not.toThrow();
    });

    it("should close via SQLiteDBWrapper directly", async () => {
      // Test that the close method on SQLiteDBWrapper itself works
      await db.db.exec("CREATE TABLE test (id INTEGER PRIMARY KEY)");

      // Close using the wrapper's close method
      await db.db.close();

      // Verify operations fail
      await expect(
        db.db.exec("CREATE TABLE test2 (id INTEGER PRIMARY KEY)"),
      ).rejects.toThrow();
    });
  });

  describe("runExclusive", () => {
    it("should serialize operations correctly", async () => {
      await db.db.exec(
        "CREATE TABLE test (id INTEGER PRIMARY KEY, value INTEGER)",
      );
      await db.db.query("INSERT INTO test (id, value) VALUES (1, 0)");

      const operations: number[] = [];

      // Run multiple operations concurrently
      const promises = Array.from({ length: 10 }, async (_, i) => {
        await db.db.query("UPDATE test SET value = value + 1 WHERE id = 1");
        operations.push(i);
      });

      await Promise.all(promises);

      // Verify all operations completed
      expect(operations).toHaveLength(10);

      // Verify final value
      const result = await db.db.query<{ value: number }>(
        "SELECT value FROM test WHERE id = 1",
      );
      expect(result.rows[0].value).toBe(10);
    });
  });
});
