import { beforeEach, describe, expect, it, vi } from "vitest";
import { BookLibraryStore } from "./BookLibraryStore";

describe("BookLibraryStore", () => {
  let store: BookLibraryStore;

  beforeEach(async () => {
    // Clear IndexedDB before each test
    const databases = await indexedDB.databases();
    for (const db of databases) {
      if (db.name) {
        indexedDB.deleteDatabase(db.name);
      }
    }

    store = await BookLibraryStore.create();
  });

  it("should initialize with empty books array", () => {
    expect(store.books).toEqual([]);
    expect(store.isLoading).toBe(false);
  });

  it("should add a book from epub file", async () => {
    // Load test epub file
    const response = await fetch(
      "/epubs/Alice's Adventures in Wonderland.epub",
    );
    const blob = await response.blob();
    const file = new File([blob], "alice.epub", {
      type: "application/epub+zip",
    });

    const bookId = await store.addBook(file);

    expect(bookId).toBeTruthy();
    expect(store.books.length).toBe(1);
    expect(store.books[0].title).toContain("Alice");
  });

  it("should add multiple books", async () => {
    // Load both test epub files
    const aliceResponse = await fetch(
      "/epubs/Alice's Adventures in Wonderland.epub",
    );
    const aliceBlob = await aliceResponse.blob();
    const aliceFile = new File([aliceBlob], "alice.epub", {
      type: "application/epub+zip",
    });

    const proposalResponse = await fetch("/epubs/A Modest Proposal.epub");
    const proposalBlob = await proposalResponse.blob();
    const proposalFile = new File([proposalBlob], "proposal.epub", {
      type: "application/epub+zip",
    });

    await store.addBook(aliceFile);
    await store.addBook(proposalFile);

    expect(store.books.length).toBe(2);
    const titles = store.books.map((book) => book.title);
    expect(titles).toContain("Alice's Adventures in Wonderland");
    expect(titles).toContain("A Modest Proposal");
  });

  it("should delete a book", async () => {
    // Add a book first
    const response = await fetch(
      "/epubs/Alice's Adventures in Wonderland.epub",
    );
    const blob = await response.blob();
    const file = new File([blob], "alice.epub", {
      type: "application/epub+zip",
    });

    const bookId = await store.addBook(file);
    expect(store.books.length).toBe(1);

    // Delete the book
    await store.deleteBook(bookId);
    expect(store.books.length).toBe(0);
  });

  it("should load book for reading", async () => {
    // Add a book first
    const response = await fetch(
      "/epubs/Alice's Adventures in Wonderland.epub",
    );
    const blob = await response.blob();
    const file = new File([blob], "alice.epub", {
      type: "application/epub+zip",
    });

    const bookId = await store.addBook(file);

    // Load the book for reading
    const result = await store.loadBookForReading(bookId);

    expect(result).not.toBeNull();
    expect(result?.blob).toBeInstanceOf(Blob);
    expect(result?.metadata.id).toBe(bookId);
    expect(result?.metadata.title).toContain("Alice");
  });

  it("should update last opened timestamp when loading book", async () => {
    // Add a book
    const response = await fetch(
      "/epubs/Alice's Adventures in Wonderland.epub",
    );
    const blob = await response.blob();
    const file = new File([blob], "alice.epub", {
      type: "application/epub+zip",
    });

    const bookId = await store.addBook(file);
    const originalLastOpened = store.books[0].lastOpened;

    // Wait a bit to ensure timestamp difference
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Load the book
    await store.loadBookForReading(bookId);

    // Reload books to get updated metadata
    await store.loadBooks();

    const updatedLastOpened = store.books[0].lastOpened;
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
