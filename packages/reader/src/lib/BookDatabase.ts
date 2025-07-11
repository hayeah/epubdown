import { Migrator } from "@hayeah/sqlite-browser";
import type { SQLiteDBWrapper } from "@hayeah/sqlite-browser";

export interface BookMetadata {
  id: string;
  title: string;
  fileSize: number;
  createdAt: number;
  lastOpenedAt?: number;
  metadata?: Blob;
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

    return new BookDatabase(db);
  }

  async addBook(book: Omit<BookMetadata, "createdAt">): Promise<void> {
    const sql = `
      INSERT INTO books (
        id, title, file_size, created_at, metadata
      ) VALUES (?, ?, ?, ?, ?)
    `;

    await this.db.query(sql, [
      book.id,
      book.title,
      book.fileSize,
      Date.now(),
      book.metadata || null,
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
      "SELECT * FROM books ORDER BY created_at DESC",
    );

    return results.rows.map(this.rowToBookMetadata);
  }

  async updateLastOpened(id: string): Promise<void> {
    await this.db.query("UPDATE books SET last_opened_at = ? WHERE id = ?", [
      Date.now(),
      id,
    ]);
  }

  async deleteBook(id: string): Promise<void> {
    await this.db.query("DELETE FROM books WHERE id = ?", [id]);
  }

  private rowToBookMetadata(row: any): BookMetadata {
    return {
      id: row.id,
      title: row.title,
      fileSize: row.file_size,
      createdAt: row.created_at,
      lastOpenedAt: row.last_opened_at,
      metadata: row.metadata,
    };
  }
}
