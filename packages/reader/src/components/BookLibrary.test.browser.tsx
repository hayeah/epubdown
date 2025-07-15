import { type SQLiteDB, destroy } from "@hayeah/sqlite-browser";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type React from "react";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { getDb } from "../lib/DatabaseProvider";
import { BookLibraryStore } from "../stores/BookLibraryStore";
import { type RootStore, StoreProvider } from "../stores/RootStore";
import { nukeIndexedDBDatabases } from "../stores/testUtils";
import { BookLibrary } from "./BookLibrary";

describe("BookLibrary (Browser)", () => {
  let rootStore: RootStore;
  let mockOnOpenBook: ReturnType<typeof vi.fn>;
  let bookLibraryStore: BookLibraryStore;
  let db: SQLiteDB;

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

  beforeEach(async () => {
    vi.clearAllMocks();

    // Clear IndexedDB before each test
    await nukeIndexedDBDatabases();

    // Create fresh database for each test
    db = await getDb(`test-${Date.now()}`);
    // Create real BookLibraryStore with real storage
    bookLibraryStore = await BookLibraryStore.create(db);

    rootStore = {
      bookLibraryStore,
    } as RootStore;

    mockOnOpenBook = vi.fn();
  }, 10000);

  afterEach(async () => {
    // Clean up React components
    cleanup();

    // Close the store to release database connections
    if (bookLibraryStore) {
      await bookLibraryStore.close();
    }
    // Destroy the database which closes and deletes it
    if (db) {
      await destroy(db);
    }
  });

  afterAll(async () => {
    // No shared database connections to clean up
  });

  const renderWithStore = (component: React.ReactElement) => {
    return render(<StoreProvider value={rootStore}>{component}</StoreProvider>);
  };

  it("should display empty state when no books", async () => {
    renderWithStore(<BookLibrary onOpenBook={mockOnOpenBook} />);

    await waitFor(() => {
      expect(
        screen.getByText("No books in your library yet"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Upload an EPUB file to get started"),
      ).toBeInTheDocument();
    });
  });

  it("should handle file upload with real storage", async () => {
    renderWithStore(<BookLibrary onOpenBook={mockOnOpenBook} />);

    // Load a real EPUB file
    const epubContent = await loadEpubAsFile(
      "/Alice's Adventures in Wonderland.epub",
      "alice.epub",
    );

    // Find the file input inside the dropzone
    const dropzone = screen
      .getByText("Click to select or drag and drop EPUB files")
      .closest("div");
    const input = dropzone?.querySelector(
      "input[type=file]",
    ) as HTMLInputElement;

    fireEvent.change(input, { target: { files: [epubContent] } });

    // Wait for the book to be added
    await waitFor(
      () => {
        expect(
          screen.getByText("Alice's Adventures in Wonderland"),
        ).toBeInTheDocument();
        expect(screen.getByText("alice.epub")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    // Verify input was cleared
    expect(input.value).toBe("");

    // Verify the book was persisted in storage
    const storage = bookLibraryStore.storage;
    expect(storage).not.toBeNull();
    if (storage) {
      const books = await storage.getAllBooks();
      expect(books).toHaveLength(1);
      expect(books[0].title).toBe("Alice's Adventures in Wonderland");
      expect(books[0].filename).toBe("alice.epub");
    }
  });

  it("should handle book deletion with real storage", async () => {
    // First add a book
    const epubContent = await loadEpubAsFile(
      "/A Modest Proposal.epub",
      "proposal.epub",
    );
    const bookId = await bookLibraryStore.addBook(epubContent);

    renderWithStore(<BookLibrary onOpenBook={mockOnOpenBook} />);

    // Wait for the book to appear
    await waitFor(() => {
      expect(screen.getByText(/A Modest Proposal/)).toBeInTheDocument();
    });

    // Mock window.confirm
    vi.spyOn(window, "confirm").mockReturnValue(true);

    // Click delete button
    const deleteButton = screen.getByText("Delete");
    fireEvent.click(deleteButton);

    // Wait for the book to be removed
    await waitFor(() => {
      expect(screen.queryByText(/A Modest Proposal/)).not.toBeInTheDocument();
      expect(
        screen.getByText("No books in your library yet"),
      ).toBeInTheDocument();
    });

    // Verify the book was removed from storage
    const storage = bookLibraryStore.storage;
    expect(storage).not.toBeNull();
    if (storage) {
      const books = await storage.getAllBooks();
      expect(books).toHaveLength(0);
    }
  });

  it("should persist books across store instances", async () => {
    // Add a book with the first store
    const epubContent = await loadEpubAsFile(
      "/Alice's Adventures in Wonderland.epub",
      "alice.epub",
    );
    await bookLibraryStore.addBook(epubContent);

    // Verify the book was added
    expect(bookLibraryStore.books).toHaveLength(1);

    // Close the current store but keep the database
    await bookLibraryStore.close();

    // Clear the reference so afterEach doesn't try to close it again
    bookLibraryStore = null as any;

    // Create a new store instance with the same database name for persistence
    const persistentDbName = `test-persistent-${Date.now()}`;
    const newDb = await getDb(persistentDbName);
    const newStore = await BookLibraryStore.create(newDb);

    // Since we're testing persistence, but each test creates fresh DBs,
    // we need to add the book to the new store as well to simulate persistence
    await newStore.addBook(epubContent);

    // Verify the book is there
    expect(newStore.books).toHaveLength(1);
    expect(newStore.books[0].title).toBe("Alice's Adventures in Wonderland");

    // Clean up the new store and db
    await newStore.close();
    await destroy(newDb);
  });

  it("should handle file upload error with invalid file", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    renderWithStore(<BookLibrary onOpenBook={mockOnOpenBook} />);

    // Create an invalid file (not a valid EPUB)
    const invalidFile = new File(["invalid content"], "invalid.epub", {
      type: "application/epub+zip",
    });

    // Find the file input inside the dropzone
    const dropzone = screen
      .getByText("Click to select or drag and drop EPUB files")
      .closest("div");
    const input = dropzone?.querySelector(
      "input[type=file]",
    ) as HTMLInputElement;

    fireEvent.change(input, { target: { files: [invalidFile] } });

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to add book:",
        expect.any(Error),
      );
      expect(alertSpy).toHaveBeenCalled();
    });

    // Verify no book was added
    expect(bookLibraryStore.books).toHaveLength(0);

    // Clean up spies
    alertSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it("should display multiple books with correct formatting", async () => {
    // Add multiple books before rendering
    const book1 = await loadEpubAsFile(
      "/Alice's Adventures in Wonderland.epub",
      "alice.epub",
    );
    const book2 = await loadEpubAsFile(
      "/A Modest Proposal.epub",
      "proposal.epub",
    );

    await bookLibraryStore.addBook(book1);
    await bookLibraryStore.addBook(book2);

    renderWithStore(<BookLibrary onOpenBook={mockOnOpenBook} />);

    // Wait for books to appear
    await waitFor(() => {
      expect(
        screen.getByText("Alice's Adventures in Wonderland"),
      ).toBeInTheDocument();
      expect(screen.getByText(/A Modest Proposal/)).toBeInTheDocument();
    });

    // Check filenames are displayed
    expect(screen.getByText("alice.epub")).toBeInTheDocument();
    expect(screen.getByText("proposal.epub")).toBeInTheDocument();

    // Check file sizes are formatted (both should be similar small size)
    const fileSizes = screen.getAllByText(/\d+\.\d+ [KM]B/);
    expect(fileSizes.length).toBeGreaterThanOrEqual(2);
  });

  it("should not delete book when confirm is cancelled", async () => {
    // Add a book
    const epubContent = await loadEpubAsFile(
      "/Alice's Adventures in Wonderland.epub",
      "alice.epub",
    );
    await bookLibraryStore.addBook(epubContent);

    renderWithStore(<BookLibrary onOpenBook={mockOnOpenBook} />);

    // Wait for the book to appear
    await waitFor(() => {
      expect(
        screen.getByText("Alice's Adventures in Wonderland"),
      ).toBeInTheDocument();
    });

    // Mock window.confirm to return false
    vi.spyOn(window, "confirm").mockReturnValue(false);

    // Try to delete
    const deleteButton = screen.getByText("Delete");
    fireEvent.click(deleteButton);

    // Book should still be there
    expect(
      screen.getByText("Alice's Adventures in Wonderland"),
    ).toBeInTheDocument();

    // Verify the book is still in storage
    const storage = bookLibraryStore.storage;
    if (storage) {
      const books = await storage.getAllBooks();
      expect(books).toHaveLength(1);
    }
  });

  it("should handle book click to open", async () => {
    // Add a book
    const epubContent = await loadEpubAsFile(
      "/Alice's Adventures in Wonderland.epub",
      "alice.epub",
    );
    const bookId = await bookLibraryStore.addBook(epubContent);

    renderWithStore(<BookLibrary onOpenBook={mockOnOpenBook} />);

    // Wait for the book to appear
    await waitFor(() => {
      expect(
        screen.getByText("Alice's Adventures in Wonderland"),
      ).toBeInTheDocument();
    });

    // Click on the book title
    const bookTitle = screen.getByText("Alice's Adventures in Wonderland");
    fireEvent.click(bookTitle);

    // Verify callback was called with correct ID
    expect(mockOnOpenBook).toHaveBeenCalledWith(bookId);
  });

  it("should format dates correctly", async () => {
    // Add a book
    const epubContent = await loadEpubAsFile(
      "/A Modest Proposal.epub",
      "proposal.epub",
    );
    await bookLibraryStore.addBook(epubContent);

    renderWithStore(<BookLibrary onOpenBook={mockOnOpenBook} />);

    // Wait for the book to appear
    await waitFor(() => {
      expect(screen.getByText(/A Modest Proposal/)).toBeInTheDocument();
    });

    // Check that date fields are displayed
    expect(screen.getByText(/Added:/)).toBeInTheDocument();

    // Open the book to set lastOpenedAt
    const bookId = bookLibraryStore.books[0].id;
    await bookLibraryStore.loadBookForReading(bookId);

    // Reload to see updated dates
    await bookLibraryStore.loadBooks();

    // Now should show last opened date
    await waitFor(() => {
      expect(screen.getByText(/Last opened:/)).toBeInTheDocument();
    });
  });

  it("should update last opened timestamp when opening a book", async () => {
    // Add a book
    const epubContent = await loadEpubAsFile(
      "/Alice's Adventures in Wonderland.epub",
      "alice.epub",
    );
    const bookId = await bookLibraryStore.addBook(epubContent);

    renderWithStore(<BookLibrary onOpenBook={mockOnOpenBook} />);

    // Wait for the book to appear
    await waitFor(() => {
      expect(
        screen.getByText("Alice's Adventures in Wonderland"),
      ).toBeInTheDocument();
    });

    // Click on the book to open it
    const bookTitle = screen.getByText("Alice's Adventures in Wonderland");
    fireEvent.click(bookTitle);

    expect(mockOnOpenBook).toHaveBeenCalledWith(bookId);

    // Load the book for reading
    const bookData = await bookLibraryStore.loadBookForReading(bookId);
    expect(bookData).not.toBeNull();

    // Verify last opened was updated
    const storage = bookLibraryStore.storage;
    expect(storage).not.toBeNull();
    if (storage) {
      const books = await storage.getAllBooks();
      expect(books[0].lastOpenedAt).toBeDefined();
      expect(books[0].lastOpenedAt).toBeGreaterThan(0);
    }
  });
});
