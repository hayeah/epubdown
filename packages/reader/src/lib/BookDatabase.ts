import type { SQLiteDB } from "@hayeah/sqlite-browser";
import { base64ToUint8Array, uint8ArrayToBase64 } from "./base64";

export interface BookMetadata {
  id: string;
  title: string;
  filename: string;
  fileSize: number;
  createdAt: number;
  lastOpenedAt?: number;
  metadata?: Uint8Array;
}

export class BookDatabase {
  private db: SQLiteDB;

  private constructor(db: SQLiteDB) {
    this.db = db;
  }

  static async create(db: SQLiteDB): Promise<BookDatabase> {
    return new BookDatabase(db);
  }

  async addBook(book: Omit<BookMetadata, "createdAt">): Promise<void> {
    const sql = `
      INSERT INTO books (
        id, title, filename, file_size, created_at, metadata
      ) VALUES (?, ?, ?, ?, ?, ?)
    `;

    // Convert Uint8Array to base64 string for SQLite storage
    let metadataBase64 = null;
    if (book.metadata) {
      metadataBase64 = uint8ArrayToBase64(book.metadata);
    }

    await this.db.exec(sql, [
      book.id,
      book.title,
      book.filename,
      book.fileSize,
      Date.now(),
      metadataBase64,
    ]);
  }

  async getBook(id: string): Promise<BookMetadata | null> {
    const result = await this.db.query("SELECT * FROM books WHERE id = ?", [
      id,
    ]);

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return this.rowToBookMetadata(row);
  }

  async getAllBooks(): Promise<BookMetadata[]> {
    const results = await this.db.query(
      "SELECT * FROM books ORDER BY created_at DESC",
    );

    return results.rows.map(this.rowToBookMetadata);
  }

  async updateLastOpened(id: string): Promise<void> {
    await this.db.exec("UPDATE books SET last_opened_at = ? WHERE id = ?", [
      Date.now(),
      id,
    ]);
  }

  async deleteBook(id: string): Promise<void> {
    await this.db.exec("DELETE FROM books WHERE id = ?", [id]);
  }

  private rowToBookMetadata(row: any): BookMetadata {
    // Convert base64 string back to Uint8Array if metadata exists
    let metadataBytes = undefined;
    if (row.metadata) {
      metadataBytes = base64ToUint8Array(row.metadata);
    }

    return {
      id: row.id,
      title: row.title,
      filename: row.filename,
      fileSize: row.file_size,
      createdAt: row.created_at,
      lastOpenedAt: row.last_opened_at,
      metadata: metadataBytes,
    };
  }
}
