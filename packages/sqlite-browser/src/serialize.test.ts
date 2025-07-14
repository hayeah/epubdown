import { describe, expect, it } from "vitest";
import { SQLiteDB } from "./SQLiteDB";
import { deserialize, serialize } from "./serialize";

describe("serialize", () => {
  it("should export and restore database with round-trip integrity", async () => {
    // Create and populate a database
    const db = await SQLiteDB.open(":memory:");

    // Create tables with various data types
    await db.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE,
        score REAL,
        data BLOB,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.exec(`
      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        is_active BOOLEAN DEFAULT 1
      )
    `);

    // Insert test data
    await db.exec(
      "INSERT INTO users (name, email, score, data) VALUES (?, ?, ?, ?)",
      ["Alice", "alice@example.com", 98.5, new Uint8Array([1, 2, 3, 4, 5])],
    );
    await db.exec(
      "INSERT INTO users (name, email, score, data) VALUES (?, ?, ?, ?)",
      ["Bob", "bob@example.com", 87.3, new Uint8Array([10, 20, 30])],
    );
    await db.exec("INSERT INTO users (name, email, score) VALUES (?, ?, ?)", [
      "Charlie",
      "charlie@example.com",
      null,
    ]);

    await db.exec("INSERT INTO settings (key, value) VALUES (?, ?)", [
      "theme",
      "dark",
    ]);
    await db.exec(
      "INSERT INTO settings (key, value, is_active) VALUES (?, ?, ?)",
      ["debug", "true", 0],
    );

    // Export the database
    const serialized = await serialize(db);
    expect(serialized).toBeInstanceOf(Uint8Array);
    expect(serialized.length).toBeGreaterThan(0);

    // Create a new database and import the serialized data
    const db2 = await SQLiteDB.open(":memory:");
    await deserialize(db2, serialized);

    // Verify the data
    const users = await db2.query("SELECT * FROM users ORDER BY id");
    expect(users.rows).toHaveLength(3);
    expect(users.rows[0]).toMatchObject({
      id: 1,
      name: "Alice",
      email: "alice@example.com",
      score: 98.5,
    });
    expect(users.rows[0].data).toEqual(new Uint8Array([1, 2, 3, 4, 5]));
    expect(users.rows[2].score).toBeNull();

    const settings = await db2.query("SELECT * FROM settings ORDER BY key");
    expect(settings.rows).toHaveLength(2);
    expect(settings.rows[0]).toMatchObject({
      key: "debug",
      value: "true",
      is_active: 0,
    });

    await db.close();
    await db2.close();
  });

  it("should handle empty database", async () => {
    const db = await SQLiteDB.open(":memory:");

    const serialized = await serialize(db);
    expect(serialized).toBeInstanceOf(Uint8Array);
    expect(serialized.length).toBeGreaterThan(0); // Even empty DB has header/metadata

    await db.close();
  });

  it("should preserve database after export", async () => {
    const db = await SQLiteDB.open(":memory:");
    await db.exec("CREATE TABLE test (value TEXT)");
    await db.exec("INSERT INTO test VALUES (?)", ["before export"]);

    // Export shouldn't affect the database
    await serialize(db);

    // Can still use the database
    await db.exec("INSERT INTO test VALUES (?)", ["after export"]);
    const result = await db.query("SELECT * FROM test ORDER BY value");
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].value).toBe("after export");
    expect(result.rows[1].value).toBe("before export");

    await db.close();
  });
});
