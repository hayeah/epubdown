import { Migrator } from "@hayeah/sqlite-browser";
import type { SQLiteDBWrapper } from "@hayeah/sqlite-browser";

export interface BookMetadata {
  id: string;
  title: string;
  author?: string;
  publisher?: string;
  publishedDate?: string;
  language?: string;
  identifier?: string;
  description?: string;
  coverImageUrl?: string;
  fileSize?: number;
  addedAt: number;
  lastOpenedAt?: number;
  readingProgress?: number;
  currentChapter?: number;
  blobStoreKey: string;
}

export class BookDatabase {
  private db: SQLiteDBWrapper;

  private constructor(db: SQLiteDBWrapper) {
    this.db = db;
  }

  static async create(db: SQLiteDBWrapper): Promise<BookDatabase> {
    const migrator = new Migrator(db);

    const migration001 = `
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
    `;

    await migrator.up([{ name: "001_create_books_table", up: migration001 }]);

    return new BookDatabase(db);
  }

  async addBook(book: Omit<BookMetadata, "addedAt">): Promise<void> {
    const sql = `
      INSERT INTO books (
        id, title, author, publisher, published_date, language,
        identifier, description, cover_image_url, file_size,
        added_at, blob_store_key
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await this.db.query(sql, [
      book.id,
      book.title,
      book.author || null,
      book.publisher || null,
      book.publishedDate || null,
      book.language || null,
      book.identifier || null,
      book.description || null,
      book.coverImageUrl || null,
      book.fileSize || null,
      Date.now(),
      book.blobStoreKey,
    ]);
  }

  async getBook(id: string): Promise<BookMetadata | null> {
    const result = await this.db.query<any>(
      "SELECT * FROM books WHERE id = ?",
      [id],
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return this.rowToBookMetadata(row);
  }

  async getAllBooks(): Promise<BookMetadata[]> {
    const results = await this.db.query<any>(
      "SELECT * FROM books ORDER BY added_at DESC",
    );

    return results.rows.map(this.rowToBookMetadata);
  }

  async updateLastOpened(id: string): Promise<void> {
    await this.db.query("UPDATE books SET last_opened_at = ? WHERE id = ?", [
      Date.now(),
      id,
    ]);
  }

  async updateReadingProgress(
    id: string,
    progress: number,
    currentChapter: number,
  ): Promise<void> {
    await this.db.query(
      "UPDATE books SET reading_progress = ?, current_chapter = ? WHERE id = ?",
      [progress, currentChapter, id],
    );
  }

  async deleteBook(id: string): Promise<void> {
    await this.db.query("DELETE FROM books WHERE id = ?", [id]);
  }

  private rowToBookMetadata(row: any): BookMetadata {
    return {
      id: row.id,
      title: row.title,
      author: row.author,
      publisher: row.publisher,
      publishedDate: row.published_date,
      language: row.language,
      identifier: row.identifier,
      description: row.description,
      coverImageUrl: row.cover_image_url,
      fileSize: row.file_size,
      addedAt: row.added_at,
      lastOpenedAt: row.last_opened_at,
      readingProgress: row.reading_progress,
      currentChapter: row.current_chapter,
      blobStoreKey: row.blob_store_key,
    };
  }
}
