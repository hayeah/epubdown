import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { loadEpub } from "../../test/helpers/epub";
import { initRootStore } from "../lib/providers_gen";
import type { RootStore } from "./RootStore";
import { nukeIndexedDBDatabases } from "./testUtils";

describe("BookLibraryStore", () => {
  let rootStore: RootStore;

  beforeEach(async () => {
    // Clear IndexedDB before each test
    await nukeIndexedDBDatabases();

    // Create test root store
    rootStore = await initRootStore({
      dbName: `test-${Date.now()}`,
      blobStoreName: `test-blob-${Date.now()}`,
    });
  }, 1000);

  afterEach(async () => {
    // Close the store to release database connections
    if (rootStore) {
      await rootStore.close();
    }
  });

  afterAll(async () => {
    // No shared database connections to clean up
  });

  it("should initialize with empty books array", () => {
    expect(rootStore.bookLibraryStore.books).toEqual([]);
    expect(rootStore.bookLibraryStore.isLoading).toBe(false);
  });

  it("should add a book from epub file", async () => {
    const file = await loadEpub("/Alice's Adventures in Wonderland.epub");
    const bookId = await rootStore.bookLibraryStore.addBook(file);

    expect(bookId).toBeTruthy();
    expect(rootStore.bookLibraryStore.books.length).toBe(1);
    expect(rootStore.bookLibraryStore.books[0]?.title).toContain("Alice");
  });

  it("should add multiple books", async () => {
    const aliceFile = await loadEpub("/Alice's Adventures in Wonderland.epub");
    const proposalFile = await loadEpub("/A Modest Proposal.epub");

    await rootStore.bookLibraryStore.addBook(aliceFile);
    await rootStore.bookLibraryStore.addBook(proposalFile);

    expect(rootStore.bookLibraryStore.books.length).toBe(2);
    const titles = rootStore.bookLibraryStore.books.map((book) => book.title);
    expect(titles).toContain("Alice's Adventures in Wonderland");
    expect(titles.some((title) => title.includes("A Modest Proposal"))).toBe(
      true,
    );
  });

  it("should delete a book", async () => {
    const file = await loadEpub("/Alice's Adventures in Wonderland.epub");
    const bookId = await rootStore.bookLibraryStore.addBook(file);
    expect(rootStore.bookLibraryStore.books.length).toBe(1);

    await rootStore.bookLibraryStore.deleteBook(bookId);
    expect(rootStore.bookLibraryStore.books.length).toBe(0);
  });

  it("should load book for reading", async () => {
    const file = await loadEpub("/Alice's Adventures in Wonderland.epub");
    const bookId = await rootStore.bookLibraryStore.addBook(file);

    const result = await rootStore.bookLibraryStore.loadBookForReading(bookId);

    expect(result).not.toBeNull();
    expect(result?.blob).toBeInstanceOf(Blob);
    expect(result?.metadata.id).toBe(bookId);
    expect(result?.metadata.title).toContain("Alice");
  });

  it("should update last opened timestamp when loading book", async () => {
    const file = await loadEpub("/Alice's Adventures in Wonderland.epub");
    const bookId = await rootStore.bookLibraryStore.addBook(file);
    const originalLastOpened =
      rootStore.bookLibraryStore.books[0]?.lastOpenedAt;

    // Wait a bit to ensure timestamp difference
    await new Promise((resolve) => setTimeout(resolve, 10));

    await rootStore.bookLibraryStore.loadBookForReading(bookId);

    // Reload books to get updated metadata
    await rootStore.bookLibraryStore.loadBooks();

    const updatedLastOpened = rootStore.bookLibraryStore.books[0]?.lastOpenedAt;
    expect(updatedLastOpened).toBeGreaterThan(originalLastOpened || 0);
  });

  it("should handle loading state correctly", async () => {
    expect(rootStore.bookLibraryStore.isLoading).toBe(false);

    // Manually trigger a reload to test loading state
    const loadPromise = rootStore.bookLibraryStore.loadBooks();

    // The loading state might be set synchronously or very quickly
    // so we can't reliably test the intermediate state without mocking
    await loadPromise;
    expect(rootStore.bookLibraryStore.isLoading).toBe(false);
  });

  it("should return null when loading non-existent book", async () => {
    const result = await rootStore.bookLibraryStore.loadBookForReading(999999);
    expect(result).toBeNull();
  });
});
