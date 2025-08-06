import { EPub } from "@epubdown/core";
import type { SQLiteDB } from "@hayeah/sqlite-browser";
import { debounce } from "lodash";
import type { DebouncedFunc } from "lodash";
import { makeAutoObservable, runInAction } from "mobx";
import { BlobStore } from "../lib/BlobStore";
import { BookDatabase, type BookMetadata } from "../lib/BookDatabase";
import { getDb } from "../lib/DatabaseProvider";

export interface StoredBook extends BookMetadata {
  blob?: Blob;
}

export class BookLibraryStore {
  books: BookMetadata[] = [];
  isLoading = false;
  searchQuery = "";
  selectedBookId: string | null = null;
  uploadProgress: number | null = null;
  isDragging = false;
  loadBooksDebounced: DebouncedFunc<() => void>;

  private constructor(
    private readonly blobStore: BlobStore,
    private readonly bookDb: BookDatabase,
    private readonly sqliteDb: SQLiteDB,
  ) {
    makeAutoObservable(this);

    // Create debounced function with lodash
    this.loadBooksDebounced = debounce(() => {
      this.loadBooks();
    }, 100);
  }

  static async create(db: SQLiteDB): Promise<BookLibraryStore> {
    const bookDb = await BookDatabase.create(db);
    const blobStore = await BlobStore.create({
      dbName: "epubdown-books",
      storeName: "books",
    });

    const store = new BookLibraryStore(blobStore, bookDb, db);
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

  async searchBooks(query: string) {
    this.searchQuery = query;
    this.isLoading = true;

    try {
      const books = await this.bookDb.searchBooks(query);
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

  setSearchQuery(query: string) {
    this.searchQuery = query;
  }

  setSelectedBookId(bookId: string | null) {
    this.selectedBookId = bookId;
  }

  setDragging(isDragging: boolean) {
    this.isDragging = isDragging;
  }

  setUploadProgress(progress: number | null) {
    this.uploadProgress = progress;
  }

  async handleFiles(files: File[]) {
    const epubFiles = files.filter((file) =>
      file.name.toLowerCase().endsWith(".epub"),
    );

    if (epubFiles.length === 0) {
      alert("Please select or drop EPUB files only");
      return;
    }

    // Track actual processing progress
    const startTime = Date.now();
    let processedCount = 0;
    const totalFiles = epubFiles.length;

    // Show progress after 300ms delay
    const progressTimeout = setTimeout(() => {
      this.setUploadProgress(0);
    }, 300);

    for (const file of epubFiles) {
      try {
        await this.addBook(file);
        processedCount++;

        // Update progress based on actual files processed
        const progress = Math.round((processedCount / totalFiles) * 100);
        runInAction(() => {
          if (this.uploadProgress !== null) {
            this.uploadProgress = progress;
          }
        });
      } catch (error) {
        console.error("Failed to add book:", error);
        alert(`Failed to add "${file.name}": ${(error as Error).message}`);
      }
    }

    // Clear progress timeout if finished before 300ms
    clearTimeout(progressTimeout);

    // If progress was shown, hide it after completion
    if (this.uploadProgress !== null) {
      this.setUploadProgress(100);
      setTimeout(() => this.setUploadProgress(null), 500);
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
    const epubMetadata = epub.metadata.toJSON();

    // Store the book file
    await this.blobStore.put(blobStoreKey, file);

    // Store metadata in SQLite
    await this.bookDb.addBook({
      id: bookId,
      title: epubMetadata.title || file.name,
      filename: file.name,
      fileSize: file.size,
    });

    // Reload books list with debounce
    this.loadBooksDebounced();

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

    // Clear selection if deleting selected book
    if (this.selectedBookId === bookId) {
      this.selectedBookId = null;
    }

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
    this.loadBooksDebounced.cancel();
    this.blobStore.close();
    // Note: Database will be closed by the destroy() call in tests
    // or by the application lifecycle management
  }
}
