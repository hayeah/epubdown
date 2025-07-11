import type { EPub } from "@epubdown/core";
import { createSqliteDatabase } from "@hayeah/sqlite-browser";
import { BlobStore } from "./BlobStore";
import { BookDatabase, type BookMetadata } from "./BookDatabase";

export interface StoredBook extends BookMetadata {
  blob?: Blob;
}

export class BookStorage {
  private blobStore: BlobStore;
  private bookDb: BookDatabase;

  private constructor(blobStore: BlobStore, bookDb: BookDatabase) {
    this.blobStore = blobStore;
    this.bookDb = bookDb;
  }

  static async create(): Promise<BookStorage> {
    const sqliteDb = await createSqliteDatabase({
      databaseName: "epubdown.db",
      storeName: "epubdown-sqlite",
      useIndexedDB: true,
    });

    const bookDb = new BookDatabase(sqliteDb.db);
    const blobStore = await BlobStore.create({
      dbName: "epubdown-books",
      storeName: "books",
    });
    await bookDb.initialize();

    return new BookStorage(blobStore, bookDb);
  }

  async addBook(file: File, epub: EPub): Promise<string> {
    // Generate a clean ID from filename
    const bookId = this.generateBookId(file.name);
    const blobStoreKey = `book-${bookId}`;

    // Extract metadata from epub
    const metadata = epub.metadata;

    // Store the blob
    await this.blobStore.put(blobStoreKey, file);

    // Store metadata in SQLite
    await this.bookDb.addBook({
      id: bookId,
      title: metadata.title || file.name,
      author: metadata.creator,
      publisher: metadata.publisher,
      publishedDate: metadata.date,
      language: metadata.language,
      identifier: metadata.identifier,
      description: metadata.description,
      coverImageUrl: metadata.cover,
      fileSize: file.size,
      blobStoreKey,
    });

    return bookId;
  }

  async getBook(id: string): Promise<StoredBook | null> {
    const metadata = await this.bookDb.getBook(id);
    if (!metadata) return null;

    const blob = await this.blobStore.getBlob(metadata.blobStoreKey);
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
    await this.blobStore.delete(book.blobStoreKey);

    // Then delete metadata
    await this.bookDb.deleteBook(id);
  }

  async updateLastOpened(id: string): Promise<void> {
    await this.bookDb.updateLastOpened(id);
  }

  async updateReadingProgress(
    id: string,
    progress: number,
    currentChapter: number,
  ): Promise<void> {
    await this.bookDb.updateReadingProgress(id, progress, currentChapter);
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
}
