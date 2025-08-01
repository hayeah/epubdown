import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SQLiteDB } from "./";

describe("SQLite Database - Uint8Array BLOB Storage", () => {
  let db: SQLiteDB;

  beforeEach(async () => {
    db = await SQLiteDB.open(":memory:");
  });

  afterEach(async () => {
    await db.close();
  });

  it("should store and retrieve Uint8Array data in BLOB column", async () => {
    // Create table with BLOB column
    await db.exec(`
      CREATE TABLE files (
        id INTEGER PRIMARY KEY,
        name TEXT,
        data BLOB
      )
    `);

    // Test data with various byte values
    const testData = new Uint8Array([0, 1, 2, 3, 127, 128, 255]);

    // Insert Uint8Array into BLOB column
    await db.query("INSERT INTO files (name, data) VALUES (?, ?)", [
      "test.bin",
      testData,
    ]);

    // Retrieve the data
    const result = await db.query<{ name: string; data: Uint8Array }>(
      "SELECT * FROM files WHERE name = ?",
      ["test.bin"],
    );

    // Verify the result
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].name).toBe("test.bin");
    expect(result.rows[0].data).toBeInstanceOf(Uint8Array);
    expect(result.rows[0].data.length).toBe(testData.length);
    expect(Array.from(result.rows[0].data)).toEqual(Array.from(testData));
  });
});
