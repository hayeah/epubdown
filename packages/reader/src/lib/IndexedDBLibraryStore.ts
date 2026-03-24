import type { SQLiteDB } from "@hayeah/sqlite-browser";
import type { BlobStore } from "./BlobStore";
import type { BookMetadata, LibraryStore } from "./LibraryStore";

/**
 * LibraryStore backed by IndexedDB blobs + SQLite metadata.
 * This wraps the existing storage for the built-in "My Library".
 */
export class IndexedDBLibraryStore implements LibraryStore {
  constructor(
    private readonly db: SQLiteDB,
    private readonly blobStore: BlobStore,
    private readonly libraryId: string = "default",
  ) {}

  async listBooks(opts?: { match?: string }): Promise<BookMetadata[]> {
    const match = opts?.match?.trim();
    let sql: string;
    let params: any[];

    if (match) {
      const pattern = `%${match.toLowerCase()}%`;
      sql = `SELECT * FROM books WHERE library_id = ? AND (LOWER(title) LIKE ? OR LOWER(author) LIKE ?)
             ORDER BY COALESCE(last_opened_at, created_at) DESC, id DESC`;
      params = [this.libraryId, pattern, pattern];
    } else {
      sql = `SELECT * FROM books WHERE library_id = ?
             ORDER BY COALESCE(last_opened_at, created_at) DESC, id DESC`;
      params = [this.libraryId];
    }

    const result = await this.db.query(sql, params);
    return result.rows.map(rowToBookMetadata);
  }

  async loadBook(id: string): Promise<{ blob: Blob; metadata: BookMetadata }> {
    const result = await this.db.query(
      "SELECT * FROM books WHERE id = ? AND library_id = ?",
      [id, this.libraryId],
    );

    if (result.rows.length === 0) {
      throw new Error(`Book not found: ${id}`);
    }

    const metadata = rowToBookMetadata(result.rows[0]);
    const blob = await this.blobStore.getBlob(`book-${id}`);

    if (!blob) {
      throw new Error(`Book blob missing: ${id}`);
    }

    // Update last opened
    await this.db.exec("UPDATE books SET last_opened_at = ? WHERE id = ?", [
      Date.now(),
      id,
    ]);

    return { blob, metadata };
  }
}

export function rowToBookMetadata(row: any): BookMetadata {
  return {
    id: String(row.id),
    libraryId: row.library_id || "default",
    title: row.title,
    author: row.author || undefined,
    fileType: row.file_type || "epub",
    filename: row.filename,
    fileSize: row.file_size,
    lastOpenedAt: row.last_opened_at || undefined,
    metadata: row.metadata || undefined,
  };
}
