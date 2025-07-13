import { describe, expect, it } from "vitest";
import { createSqliteDatabase } from "./";

describe("SQLite Database - Browser Tests", () => {
  describe("close method", () => {
    it("should prevent IndexedDB deletion while connection is open", async () => {
      const dbName = `test-db-${Date.now()}`;
      const db = await createSqliteDatabase({
        databaseName: dbName,
        useIndexedDB: true,
      });

      expect(db).toBeDefined();

      const deletePromise = indexedDB.deleteDatabase(dbName);

      await new Promise((resolve) => setTimeout(resolve, 100));

      const dbList = await indexedDB.databases();
      const stillExists = dbList.some((dbInfo) => dbInfo.name === dbName);
      expect(stillExists).toBe(true);

      await db.close();

      await deletePromise;
    });

    it("should allow IndexedDB deletion after connection is closed", async () => {
      const dbName = `test-db-${Date.now()}-2`;
      const db = await createSqliteDatabase({
        databaseName: dbName,
        useIndexedDB: true,
      });

      expect(db).toBeDefined();

      await db.close();

      await indexedDB.deleteDatabase(dbName);

      const dbList = await indexedDB.databases();
      const exists = dbList.some((dbInfo) => dbInfo.name === dbName);
      expect(exists).toBe(false);
    });
  });
});
