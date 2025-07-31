import { Driver } from "../src/Driver";

export async function nukeIndexedDBDatabase(name: string) {
  const deleteReq = indexedDB.deleteDatabase(name);

  return new Promise<void>((resolve, reject) => {
    deleteReq.onsuccess = () => resolve();
    deleteReq.onerror = () => reject(deleteReq.error);
    deleteReq.onblocked = () => {
      // The database deletion is blocked because there are still open connections
      reject(
        new Error(
          `Database deletion blocked for: ${name}. There may be open connections.`,
        ),
      );
    };
  });
}

export async function nukeAllIndexedDBDatabases() {
  // First close all open drivers
  const openDrivers = Driver.__openedDrivers();
  for (const driver of openDrivers) {
    console.log("[sqlite] closing", driver.databaseName);
    await driver.close();
  }

  const databases = await indexedDB.databases();

  const deletePromises = databases.map(async (db) => {
    if (!db.name) {
      throw new Error("Database name is undefined");
    }

    if (!db.name.startsWith("sqlite://")) {
      return;
    }

    console.log(`delete database: ${db.name}`);
    const deleteReq = indexedDB.deleteDatabase(db.name);
    return nukeIndexedDBDatabase(db.name);
  });

  await Promise.all(deletePromises);
}
