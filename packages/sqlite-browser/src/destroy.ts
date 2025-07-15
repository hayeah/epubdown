import { Driver } from "./Driver";
import { SQLiteDB } from "./SQLiteDB";

/**
 * Destroys a SQLite database connection and removes its backing IndexedDB store if present.
 *
 * WARNING: This is a destructive operation that permanently deletes the IndexedDB store.
 * Use with extreme caution, typically only in test environments.
 *
 * @example
 * // In tests, use destroy() in afterEach for proper cleanup:
 * describe("My SQLite tests", () => {
 *   let db: SQLiteDB;
 *
 *   beforeEach(async () => {
 *     db = await SQLiteDB.open("test-db");
 *   });
 *
 *   afterEach(async () => {
 *     await destroy(db);
 *   });
 *
 *   it("should do something", async () => {
 *     await db.exec("CREATE TABLE test (id INTEGER)");
 *     // ... test logic
 *   });
 * });
 *
 * @param target - Either a Driver or SQLiteDB instance to destroy
 */
export async function destroy(target: Driver): Promise<void>;
export async function destroy(target: SQLiteDB): Promise<void>;
export async function destroy(target: Driver | SQLiteDB): Promise<void> {
  if (target instanceof SQLiteDB) {
    // SQLiteDB case - recurse with the driver
    await destroy(target.driver);
  } else if (target instanceof Driver) {
    const indexedDBStore = target.indexedDBStore;

    // First close the driver
    await target.close();

    // Then delete the IndexedDB store if it exists
    if (indexedDBStore) {
      await deleteIndexedDB(indexedDBStore);
    }
  } else {
    throw new Error("destroy() requires a Driver or SQLiteDB instance");
  }
}

/**
 * Deletes an IndexedDB database
 */
async function deleteIndexedDB(dbName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const deleteReq = indexedDB.deleteDatabase(dbName);

    deleteReq.onsuccess = () => {
      resolve();
    };

    deleteReq.onerror = () => {
      reject(new Error(`Failed to delete IndexedDB database: ${dbName}`));
    };

    deleteReq.onblocked = () => {
      reject(
        new Error(`Database deletion blocked: ${dbName} has open connections`),
      );
    };
  });
}
