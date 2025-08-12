import { EPub } from "@epubdown/core";
import type { SQLiteDB } from "@hayeah/sqlite-browser";
import { debounce } from "lodash";
import type { DebouncedFunc } from "lodash";
import { makeAutoObservable, runInAction } from "mobx";
import type { AppEventSystem } from "../app/context";
import type { ErrorItem } from "../components/ErrorFlash";
import { BlobStore } from "../lib/BlobStore";
import { BookDatabase, type BookMetadata } from "../lib/BookDatabase";
import { getDb } from "../lib/providers";

export interface StoredBook extends BookMetadata {
  blob?: Blob;
}

export class BookLibraryStore {
  books: BookMetadata[] = [];
  isLoading = false;
  searchQuery = "";
  selectedBookId: number | null = null;
  uploadProgress: number | null = null;
  isDragging = false;
  uploadErrors: ErrorItem[] = [];
  loadBooksDebounced: DebouncedFunc<() => void>;

  constructor(
    private readonly blobStore: BlobStore,
    private readonly bookDb: BookDatabase,
    private readonly sqliteDb: SQLiteDB,
    private readonly events: AppEventSystem,
  ) {
    makeAutoObservable(this);

    // Create debounced function with lodash
    this.loadBooksDebounced = debounce(() => {
      this.loadBooks();
    }, 100);
  }

  static async create(
    db: SQLiteDB,
    eventSystem: AppEventSystem,
  ): Promise<BookLibraryStore> {
    const bookDb = await BookDatabase.create(db);
    const blobStore = await BlobStore.create({
      dbName: "epubdown-books",
      storeName: "books",
    });

    const store = new BookLibraryStore(blobStore, bookDb, db, eventSystem);
    await store.loadBooks();
    return store;
  }

  setupBindings() {
    return this.events.register([
      "view:library", // Push the layer
      {
        id: "library.focusSearch",
        event: { kind: "key", combo: "/" },
        layer: "view:library",
        when: () => {
          // Only when not already focused on input
          const activeElement = document.activeElement;
          return (
            activeElement?.tagName !== "INPUT" &&
            activeElement?.tagName !== "TEXTAREA"
          );
        },
        run: () => this.focusSearchBar(),
      },
    ]);
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

  setSelectedBookId(bookId: number | null) {
    this.selectedBookId = bookId;
  }

  setDragging(isDragging: boolean) {
    this.isDragging = isDragging;
  }

  setUploadProgress(progress: number | null) {
    this.uploadProgress = progress;
  }

  addUploadError(errorMsg: string, errorDetail: string) {
    const errorId = `error-${Date.now()}-${Math.random()}`;
    this.uploadErrors.push({
      id: errorId,
      errorMsg,
      errorDetail,
    });
  }

  dismissUploadError(id: string) {
    this.uploadErrors = this.uploadErrors.filter((e) => e.id !== id);
  }

  dismissAllUploadErrors() {
    this.uploadErrors = [];
  }

  async handleFiles(files: File[]) {
    const epubFiles = files.filter((file) =>
      file.name.toLowerCase().endsWith(".epub"),
    );

    if (epubFiles.length === 0) {
      this.addUploadError(
        "Invalid files",
        "Please select or drop EPUB files only",
      );
      return;
    }

    // Track actual processing progress
    const startTime = Date.now();
    let processedCount = 0;
    const totalFiles = epubFiles.length;
    let hasErrors = false;

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
        hasErrors = true;
        runInAction(() => {
          this.addUploadError(file.name, (error as Error).message);
        });
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

  async addBook(file: File): Promise<number> {
    // Parse the EPUB to get metadata
    const arrayBuffer = await file.arrayBuffer();
    const epub = await EPub.fromZip(arrayBuffer);

    // Use OPF hash instead of full file hash for deduplication
    const contentHash = await epub.opfhash();

    // Check for duplicate
    const existing = await this.bookDb.findByHash(contentHash);
    if (existing) {
      throw new Error(`"${existing.title}" is already in your library`);
    }

    // Extract metadata from epub
    const epubMetadata = epub.metadata.toJSON();

    // Store metadata in SQLite and get auto-generated ID
    const bookId = await this.bookDb.addBook({
      title: epubMetadata.title || file.name,
      author: epubMetadata.creator || epubMetadata.author,
      filename: file.name,
      fileSize: file.size,
      metadata: JSON.stringify(epubMetadata),
      contentHash,
    });

    // Store the book file using numeric ID
    const blobStoreKey = `book-${bookId}`;
    await this.blobStore.put(blobStoreKey, file);

    // Reload books list with debounce
    this.loadBooksDebounced();

    return bookId;
  }

  async deleteBook(bookId: number) {
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
    bookId: number,
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

    // Update in-memory book metadata
    runInAction(() => {
      const book = this.books.find((b) => b.id === bookId);
      if (book) {
        book.lastOpenedAt = Date.now();
      }
    });

    return {
      blob,
      metadata,
    };
  }

  focusSearchBar(): void {
    const input = document.querySelector<HTMLInputElement>(".search-bar-input");
    if (input) {
      input.focus();
    }
  }

  async close(): Promise<void> {
    this.loadBooksDebounced.cancel();
    this.blobStore.close();
    // Note: Database will be closed by the destroy() call in tests
    // or by the application lifecycle management
  }
}
