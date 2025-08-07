import type { SQLiteDB } from "@hayeah/sqlite-browser";

export interface BookMetadata {
  id: number;
  title: string;
  author?: string;
  filename: string;
  fileSize: number;
  createdAt: number;
  lastOpenedAt?: number;
  metadata?: string; // JSON string of book metadata
  contentHash: Uint8Array;
}

export class BookDatabase {
  constructor(public readonly db: SQLiteDB) {}

  static async create(db: SQLiteDB): Promise<BookDatabase> {
    return new BookDatabase(db);
  }

  async addBook(book: Omit<BookMetadata, "id" | "createdAt">): Promise<number> {
    const sql = `
      INSERT INTO books (
        title, author, filename, file_size, created_at, metadata, content_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      RETURNING id
    `;

    const result = await this.db.query<{ id: number }>(sql, [
      book.title,
      book.author || null,
      book.filename,
      book.fileSize,
      Date.now(),
      book.metadata || null, // Already a JSON string
      book.contentHash,
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
      "SELECT * FROM books WHERE LOWER(title) LIKE ? OR LOWER(author) LIKE ? ORDER BY created_at DESC",
      [searchPattern, searchPattern],
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

  async findByHash(hash: Uint8Array): Promise<BookMetadata | null> {
    const result = await this.db.query(
      "SELECT * FROM books WHERE content_hash = ?",
      [hash],
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return this.rowToBookMetadata(row);
  }

  private rowToBookMetadata(row: any): BookMetadata {
    return {
      id: row.id,
      title: row.title,
      author: row.author,
      filename: row.filename,
      fileSize: row.file_size,
      createdAt: row.created_at,
      lastOpenedAt: row.last_opened_at,
      metadata: row.metadata, // JSON string
      contentHash: row.content_hash,
    };
  }
}
