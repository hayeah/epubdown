export async function nukeIndexedDBDatabases() {
  const databases = await indexedDB.databases();

  const deletePromises = databases.map(async (db) => {
    if (!db.name) {
      throw new Error("Database name is undefined");
    }
    const deleteReq = indexedDB.deleteDatabase(db.name);

    return new Promise<void>((resolve, reject) => {
      deleteReq.onsuccess = () => resolve();
      deleteReq.onerror = () => reject(deleteReq.error);
      deleteReq.onblocked = () => {
        // The database deletion is blocked because there are still open connections
        reject(
          new Error(
            `Database deletion blocked for: ${db.name}. There may be open connections.`,
          ),
        );
      };
    });
  });

  await Promise.all(deletePromises);
}
