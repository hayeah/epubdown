import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SQLiteDB } from "./SQLiteDB";

describe("SQLiteDBWrapper", () => {
  let db: SQLiteDB;

  beforeEach(async () => {
    db = await SQLiteDB.open(":memory:");
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
      await db.exec("CREATE TABLE test (id INTEGER PRIMARY KEY)");

      // Verify we can query it
      const result1 = await db.query(
        "SELECT name FROM sqlite_master WHERE type='table'",
      );
      expect(result1.rows).toHaveLength(1);

      // Close the database
      await db.close();

      // Verify that operations fail after closing
      await expect(
        db.exec("CREATE TABLE test2 (id INTEGER PRIMARY KEY)"),
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
      await db.exec(
        "CREATE TABLE counter (id INTEGER PRIMARY KEY, value INTEGER)",
      );
      await db.query("INSERT INTO counter (id, value) VALUES (1, 0)");

      // Start multiple operations
      const promises = Array.from({ length: 5 }, async (_, i) => {
        await db.query(`UPDATE counter SET value = ${i + 1} WHERE id = 1`);
        results.push(i);
      });

      // Wait for all operations to complete
      await Promise.all(promises);

      // Verify all operations completed
      expect(results).toHaveLength(5);

      // Verify final value before closing
      const result = await db.query<{ value: number }>(
        "SELECT value FROM counter WHERE id = 1",
      );
      expect(result.rows[0].value).toBe(5);

      // Now close should work
      await expect(db.close()).resolves.not.toThrow();
    });

    it("should work correctly within a transaction", async () => {
      await db.exec("CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)");

      // Run a transaction
      await db.transaction(async (tx) => {
        await tx.query("INSERT INTO test (value) VALUES ('hello')");
        await tx.query("INSERT INTO test (value) VALUES ('world')");
      });

      // Verify data was inserted
      const result = await db.query("SELECT COUNT(*) as count FROM test");
      expect(result.rows[0].count).toBe(2);

      // Close should work after transaction
      await expect(db.close()).resolves.not.toThrow();
    });

    it("should close via SQLiteDBWrapper directly", async () => {
      // Test that the close method on SQLiteDBWrapper itself works
      await db.exec("CREATE TABLE test (id INTEGER PRIMARY KEY)");

      // Close using the wrapper's close method
      await db.close();

      // Verify operations fail
      await expect(
        db.exec("CREATE TABLE test2 (id INTEGER PRIMARY KEY)"),
      ).rejects.toThrow();
    });
  });

  describe("runExclusive", () => {
    it("should serialize operations correctly", async () => {
      await db.exec(
        "CREATE TABLE test (id INTEGER PRIMARY KEY, value INTEGER)",
      );
      await db.query("INSERT INTO test (id, value) VALUES (1, 0)");

      const operations: number[] = [];

      // Run multiple operations concurrently
      const promises = Array.from({ length: 10 }, async (_, i) => {
        await db.query("UPDATE test SET value = value + 1 WHERE id = 1");
        operations.push(i);
      });

      await Promise.all(promises);

      // Verify all operations completed
      expect(operations).toHaveLength(10);

      // Verify final value
      const result = await db.query<{ value: number }>(
        "SELECT value FROM test WHERE id = 1",
      );
      expect(result.rows[0].value).toBe(10);
    });
  });

  describe("exec with parameters", () => {
    it("should execute SQL with query parameters", async () => {
      await db.exec(
        "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, age INTEGER)",
      );

      // Test exec with parameters for INSERT
      await db.exec("INSERT INTO users (name, age) VALUES (?, ?)", [
        "Alice",
        30,
      ]);
      await db.exec("INSERT INTO users (name, age) VALUES (?, ?)", ["Bob", 25]);

      // Verify data was inserted
      const result = await db.query<{ name: string; age: number }>(
        "SELECT name, age FROM users ORDER BY age",
      );
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0]).toEqual({ name: "Bob", age: 25 });
      expect(result.rows[1]).toEqual({ name: "Alice", age: 30 });
    });

    it("should handle UPDATE with parameters", async () => {
      await db.exec(
        "CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT, price REAL)",
      );
      await db.exec("INSERT INTO products (name, price) VALUES (?, ?)", [
        "Widget",
        9.99,
      ]);

      // Update with parameters
      await db.exec("UPDATE products SET price = ? WHERE name = ?", [
        19.99,
        "Widget",
      ]);

      // Verify update
      const result = await db.query<{ price: number }>(
        "SELECT price FROM products WHERE name = ?",
        ["Widget"],
      );
      expect(result.rows[0].price).toBe(19.99);
    });

    it("should handle DELETE with parameters", async () => {
      await db.exec(
        "CREATE TABLE items (id INTEGER PRIMARY KEY, category TEXT)",
      );
      await db.exec("INSERT INTO items (category) VALUES (?)", ["electronics"]);
      await db.exec("INSERT INTO items (category) VALUES (?)", ["books"]);
      await db.exec("INSERT INTO items (category) VALUES (?)", ["electronics"]);

      // Delete with parameters
      await db.exec("DELETE FROM items WHERE category = ?", ["electronics"]);

      // Verify deletion
      const result = await db.query<{ category: string }>(
        "SELECT category FROM items",
      );
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].category).toBe("books");
    });

    it("should handle null parameters", async () => {
      await db.exec(
        "CREATE TABLE nullable_test (id INTEGER PRIMARY KEY, value TEXT)",
      );

      // Insert null value
      await db.exec("INSERT INTO nullable_test (value) VALUES (?)", [null]);

      // Verify null was inserted
      const result = await db.query(
        "SELECT value FROM nullable_test WHERE value IS NULL",
      );
      expect(result.rows).toHaveLength(1);
    });

    it("should work with multiple parameters of different types", async () => {
      await db.exec(
        "CREATE TABLE mixed_types (id INTEGER PRIMARY KEY, text_val TEXT, int_val INTEGER, real_val REAL, blob_val BLOB)",
      );

      const blobData = new Uint8Array([1, 2, 3, 4, 5]);
      await db.exec(
        "INSERT INTO mixed_types (text_val, int_val, real_val, blob_val) VALUES (?, ?, ?, ?)",
        ["test string", 42, Math.PI, blobData],
      );

      // Verify all types were inserted correctly
      const result = await db.query<{
        text_val: string;
        int_val: number;
        real_val: number;
        blob_val: Uint8Array;
      }>("SELECT * FROM mixed_types");

      expect(result.rows[0].text_val).toBe("test string");
      expect(result.rows[0].int_val).toBe(42);
      expect(result.rows[0].real_val).toBeCloseTo(Math.PI);
      expect(result.rows[0].blob_val).toEqual(blobData);
    });

    it("should execute without parameters when array is empty", async () => {
      await db.exec(
        "CREATE TABLE no_params_test (id INTEGER PRIMARY KEY, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
      );

      // Should use simple exec path when params array is empty
      await db.exec("INSERT INTO no_params_test DEFAULT VALUES", []);

      const result = await db.query(
        "SELECT COUNT(*) as count FROM no_params_test",
      );
      expect(result.rows[0].count).toBe(1);
    });
  });

  describe("execBatch", () => {
    it("should insert multiple rows with a single prepared statement", async () => {
      await db.exec(
        "CREATE TABLE batch_test (id INTEGER PRIMARY KEY, name TEXT, value INTEGER)",
      );

      const batchParams = [
        ["Alice", 100],
        ["Bob", 200],
        ["Charlie", 300],
        ["David", 400],
        ["Eve", 500],
      ];

      await db.execBatch(
        "INSERT INTO batch_test (name, value) VALUES (?, ?)",
        batchParams,
      );

      const result = await db.query<{ name: string; value: number }>(
        "SELECT name, value FROM batch_test ORDER BY value",
      );

      expect(result.rows).toHaveLength(5);
      expect(result.rows[0]).toEqual({ name: "Alice", value: 100 });
      expect(result.rows[1]).toEqual({ name: "Bob", value: 200 });
      expect(result.rows[2]).toEqual({ name: "Charlie", value: 300 });
      expect(result.rows[3]).toEqual({ name: "David", value: 400 });
      expect(result.rows[4]).toEqual({ name: "Eve", value: 500 });
    });

    it("should handle empty batch parameters", async () => {
      await db.exec("CREATE TABLE empty_batch (id INTEGER, data TEXT)");

      await expect(
        db.execBatch("INSERT INTO empty_batch (id, data) VALUES (?, ?)", []),
      ).resolves.not.toThrow();

      const result = await db.query(
        "SELECT COUNT(*) as count FROM empty_batch",
      );
      expect(result.rows[0].count).toBe(0);
    });

    it("should handle batch updates", async () => {
      await db.exec(
        "CREATE TABLE batch_update (id INTEGER PRIMARY KEY, status TEXT)",
      );

      // Insert initial data
      await db.execBatch(
        "INSERT INTO batch_update (id, status) VALUES (?, ?)",
        [
          [1, "pending"],
          [2, "pending"],
          [3, "pending"],
        ],
      );

      // Batch update
      await db.execBatch("UPDATE batch_update SET status = ? WHERE id = ?", [
        ["completed", 1],
        ["failed", 2],
        ["completed", 3],
      ]);

      const result = await db.query<{ id: number; status: string }>(
        "SELECT id, status FROM batch_update ORDER BY id",
      );

      expect(result.rows).toEqual([
        { id: 1, status: "completed" },
        { id: 2, status: "failed" },
        { id: 3, status: "completed" },
      ]);
    });

    it("should handle batch operations with different parameter types", async () => {
      await db.exec(
        "CREATE TABLE mixed_types (id INTEGER PRIMARY KEY, text_val TEXT, int_val INTEGER, real_val REAL, blob_val BLOB)",
      );

      const batchParams = [
        ["text1", 42, 3.14, new Uint8Array([1, 2, 3])],
        ["text2", 100, 2.72, new Uint8Array([4, 5, 6])],
        [null, null, null, null], // Test null values
      ];

      await db.execBatch(
        "INSERT INTO mixed_types (text_val, int_val, real_val, blob_val) VALUES (?, ?, ?, ?)",
        batchParams,
      );

      const result = await db.query(
        "SELECT text_val, int_val, real_val, blob_val FROM mixed_types ORDER BY id",
      );

      expect(result.rows).toHaveLength(3);
      expect(result.rows[0].text_val).toBe("text1");
      expect(result.rows[0].int_val).toBe(42);
      expect(result.rows[0].real_val).toBeCloseTo(3.14);
      expect(result.rows[0].blob_val).toEqual(new Uint8Array([1, 2, 3]));

      expect(result.rows[2].text_val).toBeNull();
      expect(result.rows[2].int_val).toBeNull();
      expect(result.rows[2].real_val).toBeNull();
      expect(result.rows[2].blob_val).toBeNull();
    });

    it("should work within transactions", async () => {
      await db.exec(
        "CREATE TABLE batch_txn (id INTEGER PRIMARY KEY, value INTEGER)",
      );

      await db.transaction(async (tx) => {
        await tx.execBatch("INSERT INTO batch_txn (value) VALUES (?)", [
          [10],
          [20],
          [30],
        ]);

        // Verify within transaction
        const result = await tx.query<{ count: number }>(
          "SELECT COUNT(*) as count FROM batch_txn",
        );
        expect(result.rows[0].count).toBe(3);
      });

      // Verify after transaction
      const result = await db.query<{ sum: number }>(
        "SELECT SUM(value) as sum FROM batch_txn",
      );
      expect(result.rows[0].sum).toBe(60);
    });

    it("should handle errors in batch operations", async () => {
      await db.exec(
        "CREATE TABLE batch_error (id INTEGER PRIMARY KEY, value INTEGER NOT NULL)",
      );

      // Try to insert with NULL in NOT NULL column
      const invalidBatch = [
        [1, 100],
        [2, null], // This should cause an error
        [3, 300],
      ];

      // execBatch runs in a transaction by default, ensuring atomicity
      await expect(
        db.execBatch(
          "INSERT INTO batch_error (id, value) VALUES (?, ?)",
          invalidBatch,
        ),
      ).rejects.toThrow();

      // Verify no partial inserts occurred (transaction should have rolled back)
      const result = await db.query(
        "SELECT COUNT(*) as count FROM batch_error",
      );
      expect(result.rows[0].count).toBe(0);
    });

    it("should run in a transaction by default", async () => {
      await db.exec(
        "CREATE TABLE batch_transaction_test (id INTEGER PRIMARY KEY, value INTEGER)",
      );

      // Create a batch that will fail partway through
      const batchParams = [
        [1, 100],
        [2, 200],
        [1, 300], // Duplicate primary key - will fail
      ];

      // execBatch should fail due to primary key violation
      await expect(
        db.execBatch(
          "INSERT INTO batch_transaction_test (id, value) VALUES (?, ?)",
          batchParams,
        ),
      ).rejects.toThrow();

      // Verify no rows were inserted (transaction rolled back)
      const result = await db.query(
        "SELECT COUNT(*) as count FROM batch_transaction_test",
      );
      expect(result.rows[0].count).toBe(0);
    });
  });
});
