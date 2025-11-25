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

  const createCollectionsTable = `
    CREATE TABLE IF NOT EXISTS collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      last_opened_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_collections_created_at ON collections(created_at);
    CREATE INDEX IF NOT EXISTS idx_collections_last_opened_at ON collections(last_opened_at);
    CREATE INDEX IF NOT EXISTS idx_collections_name ON collections(name);
  `;

  await migrator.up([
    { name: "create_collections_table", up: createCollectionsTable },
  ]);

  const createCollectionFilesTable = `
    CREATE TABLE IF NOT EXISTS collection_files (
      collection_id INTEGER NOT NULL,
      file_path TEXT NOT NULL,
      content_hash BLOB NOT NULL,
      title TEXT,
      frontmatter TEXT,
      sort_order INTEGER NOT NULL,
      file_type TEXT NOT NULL,
      PRIMARY KEY (collection_id, file_path),
      FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_collection_files_collection_id ON collection_files(collection_id);
    CREATE INDEX IF NOT EXISTS idx_collection_files_content_hash ON collection_files(content_hash);
    CREATE INDEX IF NOT EXISTS idx_collection_files_file_type ON collection_files(file_type);
  `;

  await migrator.up([
    { name: "create_collection_files_table", up: createCollectionFilesTable },
  ]);
}
