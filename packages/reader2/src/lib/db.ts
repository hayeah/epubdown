import { Migrator, SQLiteDB } from "@hayeah/sqlite-browser";

let dbInstance: SQLiteDB | null = null;

async function runMigrations(db: SQLiteDB): Promise<void> {
  const migrator = new Migrator(db);

  await migrator.up([
    {
      name: "create_tables",
      up: `
        CREATE TABLE IF NOT EXISTS libraries (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          created_at INTEGER NOT NULL
        );

        INSERT OR IGNORE INTO libraries (id, name, type, created_at)
        VALUES ('default', 'My Library', 'indexeddb', 0);

        CREATE TABLE IF NOT EXISTS books (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          library_id TEXT NOT NULL DEFAULT 'default' REFERENCES libraries(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          author TEXT,
          filename TEXT,
          file_type TEXT NOT NULL DEFAULT 'epub',
          file_size INTEGER NOT NULL,
          mtime INTEGER,
          metadata TEXT,
          last_opened_at INTEGER,
          reading_progress TEXT,
          created_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_books_library_id ON books(library_id);
        CREATE INDEX IF NOT EXISTS idx_books_title ON books(title);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_books_library_filename ON books(library_id, filename);
      `,
    },
  ]);
}

export async function getDB(): Promise<SQLiteDB> {
  if (dbInstance) return dbInstance;
  const db = await SQLiteDB.open("reader2");
  await runMigrations(db);
  dbInstance = db;
  return db;
}
