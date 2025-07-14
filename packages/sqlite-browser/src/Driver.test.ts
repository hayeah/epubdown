import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SQLiteDB } from "./";

describe("SQLite Database", () => {
  let db: SQLiteDB;

  beforeEach(async () => {
    db = await SQLiteDB.open(":memory:");
  });

  afterEach(async () => {
    await db.close();
  });

  it("should create a database instance", async () => {
    expect(db).toBeDefined();
    expect(db.close).toBeDefined();
  });

  it("should execute SQL commands", async () => {
    await db.exec(`
      CREATE TABLE test (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL
      )
    `);

    const tables = await db.query<{ name: string }>(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='test'
    `);

    expect(tables.rows).toHaveLength(1);
    expect(tables.rows[0].name).toBe("test");
  });

  it("should handle parameterized queries with ? placeholders", async () => {
    await db.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        name TEXT,
        age INTEGER
      )
    `);

    await db.query("INSERT INTO users (name, age) VALUES (?, ?)", [
      "Alice",
      30,
    ]);
    await db.query("INSERT INTO users (name, age) VALUES (?, ?)", ["Bob", 25]);

    const result = await db.query<{ name: string; age: number }>(
      "SELECT * FROM users WHERE age > ? ORDER BY name",
      [24],
    );

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].name).toBe("Alice");
    expect(result.rows[1].name).toBe("Bob");
  });

  it("should handle transactions", async () => {
    await db.exec(`
      CREATE TABLE accounts (
        id INTEGER PRIMARY KEY,
        balance INTEGER NOT NULL
      )
    `);

    await db.query("INSERT INTO accounts (id, balance) VALUES (1, 100)");
    await db.query("INSERT INTO accounts (id, balance) VALUES (2, 50)");

    // Successful transaction
    await db.transaction(async (tx) => {
      await tx.query("UPDATE accounts SET balance = balance - 30 WHERE id = 1");
      await tx.query("UPDATE accounts SET balance = balance + 30 WHERE id = 2");
    });

    const result = await db.query<{ id: number; balance: number }>(
      "SELECT * FROM accounts ORDER BY id",
    );

    expect(result.rows[0].balance).toBe(70);
    expect(result.rows[1].balance).toBe(80);
  });

  it("should rollback failed transactions", async () => {
    await db.exec(`
      CREATE TABLE inventory (
        id INTEGER PRIMARY KEY,
        quantity INTEGER NOT NULL CHECK (quantity >= 0)
      )
    `);

    await db.query("INSERT INTO inventory (id, quantity) VALUES (1, 10)");

    // Transaction that should fail
    await expect(
      db.transaction(async (tx) => {
        await tx.query(
          "UPDATE inventory SET quantity = quantity - 5 WHERE id = 1",
        );
        // This should fail due to CHECK constraint
        await tx.query(
          "UPDATE inventory SET quantity = quantity - 20 WHERE id = 1",
        );
      }),
    ).rejects.toThrow();

    // Check that the first update was rolled back
    const result = await db.query<{ quantity: number }>(
      "SELECT quantity FROM inventory WHERE id = 1",
    );

    expect(result.rows[0].quantity).toBe(10);
  });

  it("should queue operations to ensure serial execution", async () => {
    await db.exec(`
      CREATE TABLE counter (
        id INTEGER PRIMARY KEY,
        value INTEGER
      )
    `);

    await db.query("INSERT INTO counter (id, value) VALUES (1, 0)");

    // Run multiple updates concurrently
    const updates = Array.from({ length: 10 }, (_, i) =>
      db.query("UPDATE counter SET value = value + 1 WHERE id = 1"),
    );

    await Promise.all(updates);

    const result = await db.query<{ value: number }>(
      "SELECT value FROM counter WHERE id = 1",
    );

    expect(result.rows[0].value).toBe(10);
  });

  it("should handle empty query results", async () => {
    await db.exec("CREATE TABLE empty (id INTEGER PRIMARY KEY)");

    const result = await db.query("SELECT * FROM empty");

    expect(result.rows).toHaveLength(0);
  });
});
