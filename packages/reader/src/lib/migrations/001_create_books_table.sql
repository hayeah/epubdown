CREATE TABLE IF NOT EXISTS books (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT,
  publisher TEXT,
  published_date TEXT,
  language TEXT,
  identifier TEXT,
  description TEXT,
  cover_image_url TEXT,
  file_size INTEGER,
  added_at INTEGER NOT NULL,
  last_opened_at INTEGER,
  reading_progress REAL DEFAULT 0,
  current_chapter INTEGER DEFAULT 0,
  blob_store_key TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_books_added_at ON books(added_at);
CREATE INDEX IF NOT EXISTS idx_books_last_opened_at ON books(last_opened_at);
CREATE INDEX IF NOT EXISTS idx_books_title ON books(title);
CREATE INDEX IF NOT EXISTS idx_books_author ON books(author);