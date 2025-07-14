import type { EPub } from "@epubdown/core";
import { SQLiteDB } from "@hayeah/sqlite-browser";
import { BlobStore } from "./BlobStore";
import { BookDatabase, type BookMetadata } from "./BookDatabase";

export interface StoredBook extends BookMetadata {
  blob?: Blob;
}

export class BookStorage {
  private blobStore: BlobStore;
  private bookDb: BookDatabase;
  private sqliteDb: SQLiteDB;

  private constructor(
    blobStore: BlobStore,
    bookDb: BookDatabase,
    sqliteDb: SQLiteDB,
  ) {
    this.blobStore = blobStore;
    this.bookDb = bookDb;
    this.sqliteDb = sqliteDb;
  }

  static async create(): Promise<BookStorage> {
    const sqliteDb = await SQLiteDB.open("epubdown");

    const bookDb = await BookDatabase.create(sqliteDb);
    const blobStore = await BlobStore.create({
      dbName: "epubdown-books",
      storeName: "books",
    });

    return new BookStorage(blobStore, bookDb, sqliteDb);
  }

  async addBook(file: File, epub: EPub): Promise<string> {
    // Generate a clean ID from filename
    const bookId = this.generateBookId(file.name);
    const blobStoreKey = `book-${bookId}`;

    // Extract metadata from epub
    const epubMetadata = epub.getMetadata();

    // Create empty metadata array (not saving metadata for now)
    const metadataArray = new Uint8Array(0);

    // Store the book file
    await this.blobStore.put(blobStoreKey, file);

    // Store metadata in SQLite
    await this.bookDb.addBook({
      id: bookId,
      title: epubMetadata.title || file.name,
      filename: file.name,
      fileSize: file.size,
      metadata: metadataArray,
    });

    return bookId;
  }

  async getBook(id: string): Promise<StoredBook | null> {
    const metadata = await this.bookDb.getBook(id);
    if (!metadata) return null;

    const blobStoreKey = `book-${id}`;
    const blob = await this.blobStore.getBlob(blobStoreKey);
    if (!blob) {
      // Book blob is missing, clean up metadata
      await this.bookDb.deleteBook(id);
      return null;
    }

    return { ...metadata, blob };
  }

  async getAllBooks(): Promise<BookMetadata[]> {
    return this.bookDb.getAllBooks();
  }

  async deleteBook(id: string): Promise<void> {
    const book = await this.bookDb.getBook(id);
    if (!book) return;

    // Delete blob first
    const blobStoreKey = `book-${id}`;
    await this.blobStore.delete(blobStoreKey);

    // Then delete metadata
    await this.bookDb.deleteBook(id);
  }

  async updateLastOpened(id: string): Promise<void> {
    await this.bookDb.updateLastOpened(id);
  }

  private generateBookId(filename: string): string {
    // Remove file extension and clean up filename
    const nameWithoutExt = filename.replace(/\.epub$/i, "");
    // Replace non-alphanumeric characters with hyphens
    const cleaned = nameWithoutExt
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens

    // Add timestamp to ensure uniqueness
    const timestamp = Date.now().toString(36);
    return `${cleaned}-${timestamp}`;
  }

  async close(): Promise<void> {
    this.blobStore.close();
    await this.sqliteDb.close();
  }
}
