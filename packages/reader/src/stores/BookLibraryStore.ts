import { EPub } from "@epubdown/core";
import { makeAutoObservable, runInAction } from "mobx";
import type { BookMetadata } from "../lib/BookDatabase";
import { BookStorage } from "../lib/BookStorage";

export class BookLibraryStore {
  books: BookMetadata[] = [];
  isLoading = false;
  private bookStorage: BookStorage;

  constructor() {
    makeAutoObservable(this);
    this.bookStorage = new BookStorage();
    this.loadBooks();
  }

  async loadBooks() {
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
    await this.bookStorage.deleteBook(bookId);
    await this.loadBooks();
  }

  async loadBookForReading(
    bookId: string,
  ): Promise<{ blob: Blob; metadata: BookMetadata } | null> {
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
}
