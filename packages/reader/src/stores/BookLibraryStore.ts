import { EPub } from "@epubdown/core";
import { makeAutoObservable, runInAction } from "mobx";
import type { BookMetadata } from "../lib/BookDatabase";
import { BookStorage } from "../lib/BookStorage";

export class BookLibraryStore {
  books: BookMetadata[] = [];
  isLoading = false;
  error: string | null = null;
  private bookStorage: BookStorage;

  constructor() {
    makeAutoObservable(this);
    this.bookStorage = new BookStorage();
    this.loadBooks();
  }

  async loadBooks() {
    this.isLoading = true;
    this.error = null;

    try {
      const books = await this.bookStorage.getAllBooks();
      runInAction(() => {
        this.books = books;
        this.isLoading = false;
      });
    } catch (error) {
      runInAction(() => {
        this.error =
          error instanceof Error ? error.message : "Failed to load books";
        this.isLoading = false;
      });
    }
  }

  async addBook(file: File): Promise<string | null> {
    this.error = null;

    try {
      // Parse the EPUB to get metadata
      const arrayBuffer = await file.arrayBuffer();
      const epub = await EPub.parse(arrayBuffer);

      // Add to storage
      const bookId = await this.bookStorage.addBook(file, epub);

      // Reload books list
      await this.loadBooks();

      return bookId;
    } catch (error) {
      runInAction(() => {
        this.error =
          error instanceof Error ? error.message : "Failed to add book";
      });
      return null;
    }
  }

  async deleteBook(bookId: string) {
    this.error = null;

    try {
      await this.bookStorage.deleteBook(bookId);
      await this.loadBooks();
    } catch (error) {
      runInAction(() => {
        this.error =
          error instanceof Error ? error.message : "Failed to delete book";
      });
    }
  }

  async loadBookForReading(
    bookId: string,
  ): Promise<{ blob: Blob; metadata: BookMetadata } | null> {
    try {
      const storedBook = await this.bookStorage.getBook(bookId);
      if (!storedBook || !storedBook.blob) return null;

      // Update last opened timestamp
      await this.bookStorage.updateLastOpened(bookId);

      return {
        blob: storedBook.blob,
        metadata: storedBook,
      };
    } catch (error) {
      runInAction(() => {
        this.error =
          error instanceof Error ? error.message : "Failed to load book";
      });
      return null;
    }
  }

  async updateReadingProgress(
    bookId: string,
    progress: number,
    currentChapter: number,
  ) {
    try {
      await this.bookStorage.updateReadingProgress(
        bookId,
        progress,
        currentChapter,
      );
    } catch (error) {
      console.error("Failed to update reading progress:", error);
    }
  }
}
