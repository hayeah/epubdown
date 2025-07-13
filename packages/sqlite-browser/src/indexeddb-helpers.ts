export async function deleteIndexedDB(dbName: string): Promise<void> {
  const deleteRequest = indexedDB.deleteDatabase(dbName);

  return new Promise((resolve, reject) => {
    deleteRequest.onsuccess = () => {
      resolve();
    };
    deleteRequest.onerror = () => {
      reject(deleteRequest.error);
    };
    deleteRequest.onblocked = (event) => {
      // The blocked event occurs when there are still active connections to the database
      // event.newVersion is null for delete operations
      // event.oldVersion contains the current version of the database
      const error = new Error(
        `Database deletion blocked: Database "${dbName}" has open connections. ` +
          `Current version: ${(event as IDBVersionChangeEvent).oldVersion}`,
      );
      reject(error);
    };
  });
}

export async function listIndexedDBDatabases(): Promise<IDBDatabaseInfo[]> {
  if (!indexedDB.databases) {
    throw new Error("indexedDB.databases() is not supported in this browser");
  }
  return await indexedDB.databases();
}

export async function indexedDBExists(dbName: string): Promise<boolean> {
  const databases = await listIndexedDBDatabases();
  return databases.some((db) => db.name === dbName);
}
