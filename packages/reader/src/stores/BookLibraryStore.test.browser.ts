import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BookLibraryStore } from "./BookLibraryStore";
import { nukeIndexedDBDatabases } from "./testUtils";

describe("BookLibraryStore", () => {
  let store: BookLibraryStore;

  beforeEach(async () => {
    // Clear IndexedDB before each test
    await nukeIndexedDBDatabases();

    store = await BookLibraryStore.create();
  }, 1000);

  afterEach(async () => {
    // Close the store to release database connections
    if (store) {
      await store.close();
    }
  });

  async function loadEpubAsFile(url: string, filename: string): Promise<File> {
    // Add 3s timeout to the fetch
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      const blob = await response.blob();
      return new File([blob], filename, { type: "application/epub+zip" });
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  it("should initialize with empty books array", () => {
    expect(store.books).toEqual([]);
    expect(store.isLoading).toBe(false);
  });

  it("should add a book from epub file", async () => {
    const file = await loadEpubAsFile(
      "/Alice's Adventures in Wonderland.epub",
      "alice.epub",
    );
    const bookId = await store.addBook(file);

    expect(bookId).toBeTruthy();
    expect(store.books.length).toBe(1);
    expect(store.books[0].title).toContain("Alice");
  });

  it("should add multiple books", async () => {
    const aliceFile = await loadEpubAsFile(
      "/Alice's Adventures in Wonderland.epub",
      "alice.epub",
    );
    const proposalFile = await loadEpubAsFile(
      "/A Modest Proposal.epub",
      "proposal.epub",
    );

    await store.addBook(aliceFile);
    await store.addBook(proposalFile);

    expect(store.books.length).toBe(2);
    const titles = store.books.map((book) => book.title);
    expect(titles).toContain("Alice's Adventures in Wonderland");
    expect(titles.some((title) => title.includes("A Modest Proposal"))).toBe(
      true,
    );
  });

  it("should delete a book", async () => {
    const file = await loadEpubAsFile(
      "/Alice's Adventures in Wonderland.epub",
      "alice.epub",
    );
    const bookId = await store.addBook(file);
    expect(store.books.length).toBe(1);

    await store.deleteBook(bookId);
    expect(store.books.length).toBe(0);
  });

  it("should load book for reading", async () => {
    const file = await loadEpubAsFile(
      "/Alice's Adventures in Wonderland.epub",
      "alice.epub",
    );
    const bookId = await store.addBook(file);

    const result = await store.loadBookForReading(bookId);

    expect(result).not.toBeNull();
    expect(result?.blob).toBeInstanceOf(Blob);
    expect(result?.metadata.id).toBe(bookId);
    expect(result?.metadata.title).toContain("Alice");
  });

  it("should update last opened timestamp when loading book", async () => {
    const file = await loadEpubAsFile(
      "/Alice's Adventures in Wonderland.epub",
      "alice.epub",
    );
    const bookId = await store.addBook(file);
    const originalLastOpened = store.books[0].lastOpenedAt;

    // Wait a bit to ensure timestamp difference
    await new Promise((resolve) => setTimeout(resolve, 10));

    await store.loadBookForReading(bookId);

    // Reload books to get updated metadata
    await store.loadBooks();

    const updatedLastOpened = store.books[0].lastOpenedAt;
    expect(updatedLastOpened).toBeGreaterThan(originalLastOpened || 0);
  });

  it("should handle loading state correctly", async () => {
    expect(store.isLoading).toBe(false);

    // Spy on getAllBooks to add delay
    const spy = vi
      .spyOn(store.storage, "getAllBooks")
      .mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return [];
      });

    const loadPromise = store.loadBooks();
    expect(store.isLoading).toBe(true);

    await loadPromise;
    expect(store.isLoading).toBe(false);

    spy.mockRestore();
  });

  it("should return null when loading non-existent book", async () => {
    const result = await store.loadBookForReading("non-existent-id");
    expect(result).toBeNull();
  });
});
