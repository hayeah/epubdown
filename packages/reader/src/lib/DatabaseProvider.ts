import { Migrator, SQLiteDB } from "@hayeah/sqlite-browser";

/**
 * Run database migrations
 */
export async function runMigrations(db: SQLiteDB): Promise<void> {
  const migrator = new Migrator(db);

  const migration001 = `
    CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      filename TEXT,
      file_size INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      last_opened_at INTEGER,
      metadata BLOB
    );

    CREATE INDEX IF NOT EXISTS idx_books_created_at ON books(created_at);
    CREATE INDEX IF NOT EXISTS idx_books_last_opened_at ON books(last_opened_at);
    CREATE INDEX IF NOT EXISTS idx_books_title ON books(title);
  `;

  await migrator.up([{ name: "001_create_books_table", up: migration001 }]);
}

/**
 * Create a new database instance with migrations applied.
 * Each call creates a fresh database connection.
 */
export async function getDb(dbName = "epubdown"): Promise<SQLiteDB> {
  const db = await SQLiteDB.open(dbName);
  await runMigrations(db);
  return db;
}
