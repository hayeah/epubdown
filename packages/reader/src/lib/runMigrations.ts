import { Migrator, type SQLiteDB } from "@hayeah/sqlite-browser";

/**
 * Run database migrations
 * Note: Migration names must be unique, but numbering is not required.
 * Avoid numbering to make code merges easier.
 */
export async function runMigrations(db: SQLiteDB): Promise<void> {
  const migrator = new Migrator(db);

  const createBooksTable = `
    CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      author TEXT,
      filename TEXT,
      file_size INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      last_opened_at INTEGER,
      metadata TEXT,
      content_hash BLOB UNIQUE
    );

    CREATE INDEX IF NOT EXISTS idx_books_created_at ON books(created_at);
    CREATE INDEX IF NOT EXISTS idx_books_last_opened_at ON books(last_opened_at);
    CREATE INDEX IF NOT EXISTS idx_books_title ON books(title);
    CREATE INDEX IF NOT EXISTS idx_books_content_hash ON books(content_hash);
  `;

  await migrator.up([{ name: "create_books_table", up: createBooksTable }]);

  const addFileTypeColumn = `
    ALTER TABLE books ADD COLUMN file_type TEXT NOT NULL DEFAULT 'epub';
    CREATE INDEX IF NOT EXISTS idx_books_file_type ON books(file_type);
  `;

  await migrator.up([{ name: "add_file_type_column", up: addFileTypeColumn }]);
}
