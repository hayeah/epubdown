import { EPub } from "@epubdown/core";
import { makeAutoObservable, runInAction } from "mobx";
import type { BookMetadata } from "../lib/BookDatabase";
import { BookStorage } from "../lib/BookStorage";

export class BookLibraryStore {
  books: BookMetadata[] = [];
  isLoading = false;
  private bookStorage: BookStorage | null = null;

  constructor() {
    makeAutoObservable(this);
    this.init();
  }

  private async init() {
    try {
      this.bookStorage = await BookStorage.create();
      await this.loadBooks();
    } catch (error) {
      console.error("Failed to initialize BookLibraryStore:", error);
      runInAction(() => {
        this.isLoading = false;
      });
    }
  }

  async loadBooks() {
    if (!this.bookStorage) {
      console.error("BookStorage not initialized");
      return;
    }

    this.isLoading = true;

    try {
      const books = await this.bookStorage.getAllBooks();
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
    if (!this.bookStorage) {
      throw new Error("BookStorage not initialized");
    }

    // Parse the EPUB to get metadata
    const arrayBuffer = await file.arrayBuffer();
    const epub = await EPub.fromZip(arrayBuffer);

    // Add to storage
    const bookId = await this.bookStorage.addBook(file, epub);

    // Reload books list
    await this.loadBooks();

    return bookId;
  }

  async deleteBook(bookId: string) {
    if (!this.bookStorage) {
      throw new Error("BookStorage not initialized");
    }

    await this.bookStorage.deleteBook(bookId);
    await this.loadBooks();
  }

  async loadBookForReading(
    bookId: string,
  ): Promise<{ blob: Blob; metadata: BookMetadata } | null> {
    if (!this.bookStorage) {
      throw new Error("BookStorage not initialized");
    }

    const storedBook = await this.bookStorage.getBook(bookId);
    if (!storedBook || !storedBook.blob) return null;

    // Update last opened timestamp
    await this.bookStorage.updateLastOpened(bookId);

    return {
      blob: storedBook.blob,
      metadata: storedBook,
    };
  }

  // TODO: Implement reading progress tracking
  async updateReadingProgress(
    bookId: string,
    progress: number,
    currentChapter: number,
  ) {
    // Not implemented yet
    console.log("Reading progress update:", {
      bookId,
      progress,
      currentChapter,
    });
  }

  // Getter for testing purposes
  get storage(): BookStorage | null {
    return this.bookStorage;
  }
}
