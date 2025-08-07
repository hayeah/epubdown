import type { SQLiteDB } from "@hayeah/sqlite-browser";
import { base64ToUint8Array, uint8ArrayToBase64 } from "./base64";

export interface BookMetadata {
  id: number;
  title: string;
  filename: string;
  fileSize: number;
  createdAt: number;
  lastOpenedAt?: number;
  metadata?: Uint8Array;
}

export class BookDatabase {
  constructor(public readonly db: SQLiteDB) {}

  static async create(db: SQLiteDB): Promise<BookDatabase> {
    return new BookDatabase(db);
  }

  async addBook(book: Omit<BookMetadata, "id" | "createdAt">): Promise<number> {
    const sql = `
      INSERT INTO books (
        title, filename, file_size, created_at, metadata
      ) VALUES (?, ?, ?, ?, ?)
      RETURNING id
    `;

    // Convert Uint8Array to base64 string for SQLite storage
    let metadataBase64 = null;
    if (book.metadata) {
      metadataBase64 = uint8ArrayToBase64(book.metadata);
    }

    const result = await this.db.query<{ id: number }>(sql, [
      book.title,
      book.filename,
      book.fileSize,
      Date.now(),
      metadataBase64,
    ]);

    if (!result.rows[0]) {
      throw new Error("Failed to get auto-generated book ID");
    }
    return result.rows[0].id;
  }

  async getBook(id: number): Promise<BookMetadata | null> {
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

  async searchBooks(query: string): Promise<BookMetadata[]> {
    if (!query.trim()) {
      return this.getAllBooks();
    }

    const searchPattern = `%${query.toLowerCase()}%`;
    const results = await this.db.query(
      "SELECT * FROM books WHERE LOWER(title) LIKE ? ORDER BY created_at DESC",
      [searchPattern],
    );

    return results.rows.map(this.rowToBookMetadata);
  }

  async updateLastOpened(id: number): Promise<void> {
    await this.db.exec("UPDATE books SET last_opened_at = ? WHERE id = ?", [
      Date.now(),
      id,
    ]);
  }

  async deleteBook(id: number): Promise<void> {
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
