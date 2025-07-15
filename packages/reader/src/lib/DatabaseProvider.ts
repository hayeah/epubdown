import { SQLiteDB } from "@hayeah/sqlite-browser";

let sharedDb: SQLiteDB | null = null;

/**
 * Get the shared SQLite database instance.
 * Creates a new instance if one doesn't exist.
 */
export async function getDb(): Promise<SQLiteDB> {
  if (!sharedDb) {
    sharedDb = await SQLiteDB.open("epubdown");
  }
  return sharedDb;
}

/**
 * Close the shared database connection and clear the reference.
 * Should be called during app cleanup or in test teardown.
 */
export async function closeDb(): Promise<void> {
  if (sharedDb) {
    await sharedDb.close();
    sharedDb = null;
  }
}

/**
 * Check if the database is currently open.
 */
export function isDbOpen(): boolean {
  return sharedDb !== null;
}
