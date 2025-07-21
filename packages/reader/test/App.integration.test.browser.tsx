import { type SQLiteDB, destroy } from "@hayeah/sqlite-browser";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React from "react";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { App } from "../src/App";
import { getDb } from "../src/lib/DatabaseProvider";
import { RootStore, StoreProvider } from "../src/stores/RootStore";
import { nukeIndexedDBDatabases } from "../src/stores/testUtils";
import { loadEpub } from "./helpers/epub";

describe("App Integration Tests (Browser)", () => {
  let rootStore: RootStore;
  let db: SQLiteDB;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Clear any existing databases first
    await nukeIndexedDBDatabases();

    // Wait a bit to ensure cleanup is complete
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Create a unique database for this test
    db = await getDb(`test-${Date.now()}`);

    // Create root store with injected database
    rootStore = await RootStore.create(db);
  }, 30000);

  afterAll(async () => {
    // Final cleanup
    await nukeIndexedDBDatabases();
  });

  afterEach(async () => {
    cleanup();

    // Close all database connections through RootStore
    if (rootStore) {
      await rootStore.close();
    }

    // Destroy the database connection
    if (db) {
      await destroy(db);
    }

    // Wait a bit for cleanup
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Clean up databases
    try {
      await nukeIndexedDBDatabases();
    } catch (error) {
      // Log but don't fail the test if cleanup has issues
      console.warn("Cleanup warning:", error);
    }
  });

  const renderApp = () => {
    // Set the base path for wouter
    window.history.pushState({}, "", "/");

    return render(
      <StoreProvider value={rootStore}>
        <App />
      </StoreProvider>,
    );
  };

  describe("Library → Reader flow", () => {
    it("should show empty state when no books are loaded", async () => {
      renderApp();

      await waitFor(
        () => {
          expect(screen.getByText("My Library")).toBeInTheDocument();
        },
        { timeout: 5000 },
      );

      expect(
        screen.getByText("No books in your library yet"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Upload an EPUB file to get started"),
      ).toBeInTheDocument();
    });

    it("should add a book and navigate to reader", async () => {
      renderApp();

      // Load Alice's Adventures in Wonderland
      const epubFile = await loadEpub("/Alice's Adventures in Wonderland.epub");
      if (!rootStore.bookLibraryStore) {
        throw new Error("BookLibraryStore not initialized");
      }
      await rootStore.bookLibraryStore.addBook(epubFile);

      // Wait for book to appear in library
      await waitFor(
        () => {
          expect(
            screen.getByText("Alice's Adventures in Wonderland"),
          ).toBeInTheDocument();
        },
        { timeout: 5000 },
      );

      // Verify author is shown
      expect(screen.getByText("Lewis Carroll")).toBeInTheDocument();

      // Click on the book to navigate to reader
      const bookCard = screen.getByText("Alice's Adventures in Wonderland");
      fireEvent.click(bookCard);

      // Wait for reader to load and show first chapter
      await waitFor(
        () => {
          expect(
            screen.getByText("CHAPTER I. Down the Rabbit-Hole"),
          ).toBeInTheDocument();
        },
        { timeout: 100 },
      );

      // Verify breadcrumb navigation
      expect(screen.getByText("← Back to Library")).toBeInTheDocument();

      // Verify chapter navigation info
      expect(screen.getByText(/Chapter \d+ of \d+/)).toBeInTheDocument();
    });

    it("should navigate back to library from reader", async () => {
      renderApp();

      // Setup: Add book and navigate to reader
      const epubFile = await loadEpub("/Alice's Adventures in Wonderland.epub");
      if (!rootStore.bookLibraryStore) {
        throw new Error("BookLibraryStore not initialized");
      }
      await rootStore.bookLibraryStore.addBook(epubFile);

      await waitFor(
        () => {
          expect(
            screen.getByText("Alice's Adventures in Wonderland"),
          ).toBeInTheDocument();
        },
        { timeout: 5000 },
      );

      fireEvent.click(screen.getByText("Alice's Adventures in Wonderland"));

      await waitFor(
        () => {
          expect(
            screen.getByText("CHAPTER I. Down the Rabbit-Hole"),
          ).toBeInTheDocument();
        },
        { timeout: 5000 },
      );

      // Navigate back to library
      const backLink = screen.getByText("← Back to Library");
      fireEvent.click(backLink);

      // Should be back at library with the book still there
      await waitFor(
        () => {
          expect(screen.getByText("My Library")).toBeInTheDocument();
        },
        { timeout: 5000 },
      );

      expect(
        screen.getByText("Alice's Adventures in Wonderland"),
      ).toBeInTheDocument();
      expect(screen.getByText("Lewis Carroll")).toBeInTheDocument();
    });
  });

  describe("Chapter navigation", () => {
    it("should navigate between chapters using nav buttons", async () => {
      renderApp();

      // Setup: Add book and navigate to reader
      const epubFile = await loadEpub("/Alice's Adventures in Wonderland.epub");
      if (!rootStore.bookLibraryStore) {
        throw new Error("BookLibraryStore not initialized");
      }
      await rootStore.bookLibraryStore.addBook(epubFile);

      await waitFor(
        () => {
          screen.getByText("Alice's Adventures in Wonderland").click();
        },
        { timeout: 5000 },
      );

      // Wait for first chapter
      await waitFor(
        () => {
          expect(
            screen.getByText("CHAPTER I. Down the Rabbit-Hole"),
          ).toBeInTheDocument();
        },
        { timeout: 5000 },
      );

      // Click next chapter button
      const nextButton = screen.getByRole("button", { name: /next/i });
      fireEvent.click(nextButton);

      // Wait for second chapter
      await waitFor(
        () => {
          expect(
            screen.getByText("CHAPTER II. The Pool of Tears"),
          ).toBeInTheDocument();
        },
        { timeout: 5000 },
      );

      // Verify chapter counter updated
      expect(screen.getByText(/Chapter 2 of \d+/)).toBeInTheDocument();

      // Click previous chapter button
      const prevButton = screen.getByRole("button", { name: /previous/i });
      fireEvent.click(prevButton);

      // Should be back at first chapter
      await waitFor(
        () => {
          expect(
            screen.getByText("CHAPTER I. Down the Rabbit-Hole"),
          ).toBeInTheDocument();
        },
        { timeout: 5000 },
      );

      expect(screen.getByText(/Chapter 1 of \d+/)).toBeInTheDocument();
    });

    it("should navigate using table of contents", async () => {
      renderApp();

      // Setup: Add book and navigate to reader
      const epubFile = await loadEpub("/Alice's Adventures in Wonderland.epub");
      if (!rootStore.bookLibraryStore) {
        throw new Error("BookLibraryStore not initialized");
      }
      await rootStore.bookLibraryStore.addBook(epubFile);

      await waitFor(
        () => {
          screen.getByText("Alice's Adventures in Wonderland").click();
        },
        { timeout: 5000 },
      );

      // Wait for reader to load
      await waitFor(
        () => {
          expect(
            screen.getByText("CHAPTER I. Down the Rabbit-Hole"),
          ).toBeInTheDocument();
        },
        { timeout: 5000 },
      );

      // Open table of contents (desktop view)
      const tocButton = screen.getByRole("button", {
        name: /table of contents/i,
      });
      fireEvent.click(tocButton);

      // Wait for TOC to appear
      await waitFor(
        () => {
          expect(screen.getByRole("navigation")).toBeInTheDocument();
        },
        { timeout: 5000 },
      );

      // Click on Chapter III in TOC
      const chapterThree = screen.getByText("CHAPTER III", { exact: false });
      fireEvent.click(chapterThree);

      // Should navigate to Chapter III
      await waitFor(
        () => {
          expect(
            screen.getByText("CHAPTER III. A Caucus-Race and a Long Tale"),
          ).toBeInTheDocument();
        },
        { timeout: 5000 },
      );

      expect(screen.getByText(/Chapter 3 of \d+/)).toBeInTheDocument();
    });
  });

  describe("Mobile responsive behavior", () => {
    it("should close TOC sidebar after selection on mobile viewport", async () => {
      // Set mobile viewport
      const originalInnerWidth = window.innerWidth;
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 375,
      });

      renderApp();

      // Setup: Add book and navigate to reader
      const epubFile = await loadEpub("/Alice's Adventures in Wonderland.epub");
      if (!rootStore.bookLibraryStore) {
        throw new Error("BookLibraryStore not initialized");
      }
      await rootStore.bookLibraryStore.addBook(epubFile);

      await waitFor(
        () => {
          screen.getByText("Alice's Adventures in Wonderland").click();
        },
        { timeout: 5000 },
      );

      await waitFor(
        () => {
          expect(
            screen.getByText("CHAPTER I. Down the Rabbit-Hole"),
          ).toBeInTheDocument();
        },
        { timeout: 5000 },
      );

      // Open TOC on mobile
      const tocButton = screen.getByRole("button", {
        name: /table of contents/i,
      });
      fireEvent.click(tocButton);

      // TOC should be visible
      await waitFor(
        () => {
          expect(screen.getByRole("navigation")).toBeInTheDocument();
        },
        { timeout: 5000 },
      );

      // Select a chapter
      const chapterTwo = screen.getByText("CHAPTER II", { exact: false });
      fireEvent.click(chapterTwo);

      // On mobile, TOC should close after selection
      await waitFor(
        () => {
          expect(
            screen.getByText("CHAPTER II. The Pool of Tears"),
          ).toBeInTheDocument();
        },
        { timeout: 5000 },
      );

      // TOC should be closed (navigation should not be visible)
      expect(screen.queryByRole("navigation")).not.toBeInTheDocument();

      // Restore original viewport
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: originalInnerWidth,
      });
    });
  });

  describe("Persistence", () => {
    it("should persist books across page reloads", async () => {
      const { unmount } = renderApp();

      // Add a book
      const epubFile = await loadEpub("/Alice's Adventures in Wonderland.epub");
      if (!rootStore.bookLibraryStore) {
        throw new Error("BookLibraryStore not initialized");
      }
      await rootStore.bookLibraryStore.addBook(epubFile);

      await waitFor(
        () => {
          expect(
            screen.getByText("Alice's Adventures in Wonderland"),
          ).toBeInTheDocument();
        },
        { timeout: 5000 },
      );

      // Unmount the app
      unmount();
      cleanup();

      // Create new database and root store (simulating page reload)
      const newDb = await getDb(`test-${Date.now()}`);
      const newRootStore = await RootStore.create(newDb);

      // Re-render the app with new store
      render(
        <StoreProvider value={newRootStore}>
          <App />
        </StoreProvider>,
      );

      // Book should still be there
      await waitFor(
        () => {
          expect(
            screen.getByText("Alice's Adventures in Wonderland"),
          ).toBeInTheDocument();
        },
        { timeout: 5000 },
      );

      expect(screen.getByText("Lewis Carroll")).toBeInTheDocument();

      // Clean up the new store and database
      await newRootStore.close();
      await destroy(newDb);
    });
  });

  describe("Error handling", () => {
    it("should handle missing chapters gracefully", async () => {
      renderApp();

      // Add book
      const epubFile = await loadEpub("/Alice's Adventures in Wonderland.epub");
      if (!rootStore.bookLibraryStore) {
        throw new Error("BookLibraryStore not initialized");
      }
      const bookId = await rootStore.bookLibraryStore.addBook(epubFile);

      await waitFor(
        () => {
          screen.getByText("Alice's Adventures in Wonderland").click();
        },
        { timeout: 5000 },
      );

      // Wait for reader to load
      await waitFor(
        () => {
          expect(
            screen.getByText("CHAPTER I. Down the Rabbit-Hole"),
          ).toBeInTheDocument();
        },
        { timeout: 5000 },
      );

      // Try to navigate to an invalid chapter index via URL
      window.history.pushState({}, "", `/book/${bookId}/999`);
      window.dispatchEvent(new PopStateEvent("popstate"));

      // Should handle gracefully (stay on current chapter or show error)
      await waitFor(
        () => {
          // Should either stay on Chapter I or show an error message
          const hasChapterOne = screen.queryByText(
            "CHAPTER I. Down the Rabbit-Hole",
          );
          const hasError = screen.queryByText(/error|not found/i);
          expect(hasChapterOne || hasError).toBeTruthy();
        },
        { timeout: 5000 },
      );
    });
  });
});
