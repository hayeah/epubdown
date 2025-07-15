import { EPub } from "@epubdown/core";
import { SQLiteDB } from "@hayeah/sqlite-browser";
import { makeAutoObservable, runInAction } from "mobx";
import { BlobStore } from "../lib/BlobStore";
import { BookDatabase, type BookMetadata } from "../lib/BookDatabase";

export interface StoredBook extends BookMetadata {
  blob?: Blob;
}

export class BookLibraryStore {
  books: BookMetadata[] = [];
  isLoading = false;

  private constructor(
    private readonly blobStore: BlobStore,
    private readonly bookDb: BookDatabase,
    private readonly sqliteDb: SQLiteDB,
  ) {
    makeAutoObservable(this);
  }

  static async create(): Promise<BookLibraryStore> {
    const sqliteDb = await SQLiteDB.open("epubdown");
    const bookDb = await BookDatabase.create(sqliteDb);
    const blobStore = await BlobStore.create({
      dbName: "epubdown-books",
      storeName: "books",
    });

    const store = new BookLibraryStore(blobStore, bookDb, sqliteDb);
    await store.loadBooks();
    return store;
  }

  async loadBooks() {
    this.isLoading = true;

    try {
      const books = await this.bookDb.getAllBooks();
      runInAction(() => {
        this.books = books;
        this.isLoading = false;
      });
    } catch (error) {
      runInAction(() => {
        this.isLoading = false;
      });
      throw error;
    }
  }

  async addBook(file: File): Promise<string> {
    // Parse the EPUB to get metadata
    const arrayBuffer = await file.arrayBuffer();
    const epub = await EPub.fromZip(arrayBuffer);

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

    // Reload books list
    await this.loadBooks();

    return bookId;
  }

  async deleteBook(bookId: string) {
    const book = await this.bookDb.getBook(bookId);
    if (!book) return;

    // Delete blob first
    const blobStoreKey = `book-${bookId}`;
    await this.blobStore.delete(blobStoreKey);

    // Then delete metadata
    await this.bookDb.deleteBook(bookId);

    await this.loadBooks();
  }

  async loadBookForReading(
    bookId: string,
  ): Promise<{ blob: Blob; metadata: BookMetadata } | null> {
    const metadata = await this.bookDb.getBook(bookId);
    if (!metadata) return null;

    const blobStoreKey = `book-${bookId}`;
    const blob = await this.blobStore.getBlob(blobStoreKey);
    if (!blob) {
      // Book blob is missing, clean up metadata
      await this.bookDb.deleteBook(bookId);
      return null;
    }

    // Update last opened timestamp
    await this.bookDb.updateLastOpened(bookId);

    return {
      blob,
      metadata,
    };
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
