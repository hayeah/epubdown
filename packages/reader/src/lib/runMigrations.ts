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

  const createPdfPageSizesTable = `
    CREATE TABLE IF NOT EXISTS pdf_page_sizes (
      book_id INTEGER NOT NULL,
      page_index INTEGER NOT NULL,
      width_pt REAL NOT NULL,
      height_pt REAL NOT NULL,
      PRIMARY KEY (book_id, page_index),
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_pdf_page_sizes_book_id ON pdf_page_sizes(book_id);
  `;

  await migrator.up([
    { name: "create_pdf_page_sizes_table", up: createPdfPageSizesTable },
  ]);

  const createLibrariesTable = `
    CREATE TABLE IF NOT EXISTS libraries (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    -- Seed the default built-in library
    INSERT OR IGNORE INTO libraries (id, name, type, created_at)
    VALUES ('default', 'My Library', 'indexeddb', 0);

    -- Add library_id to books, defaulting existing rows to 'default'
    ALTER TABLE books ADD COLUMN library_id TEXT NOT NULL DEFAULT 'default'
      REFERENCES libraries(id) ON DELETE CASCADE;

    CREATE INDEX IF NOT EXISTS idx_books_library_id ON books(library_id);

    -- Add mtime column for filesystem sync caching
    ALTER TABLE books ADD COLUMN mtime INTEGER;
  `;

  await migrator.up([
    { name: "create_libraries_table", up: createLibrariesTable },
  ]);
}
