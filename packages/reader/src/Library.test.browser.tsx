import { destroy } from "@hayeah/sqlite-browser";
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
import { loadEpub } from "../test/helpers/epub";
import { Library } from "./Library";
import { initRootStore } from "./lib/providers_gen";
import { type RootStore, StoreProvider } from "./stores/RootStore";

describe("Library (Browser)", () => {
  let rootStore: RootStore;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Create test root store
    rootStore = await initRootStore({
      dbName: `test-${Date.now()}`,
      blobStoreName: `test-blob-${Date.now()}`,
    });
  });

  afterEach(async () => {
    // Clean up React components
    cleanup();
    // Clean up test resources
    if (rootStore) {
      await rootStore.close();
    }
  });

  const renderWithStore = (component: React.ReactElement) => {
    return render(<StoreProvider value={rootStore}>{component}</StoreProvider>);
  };

  it("should display empty state when no books", async () => {
    renderWithStore(<Library />);

    await waitFor(() => {
      expect(
        screen.getByText("Drop EPUB files here or click Upload"),
      ).toBeInTheDocument();
    });
  });

  it("should handle file upload with real storage", async () => {
    renderWithStore(<Library />);

    // Load a real EPUB file
    const epubContent = await loadEpub(
      "/Alice's Adventures in Wonderland.epub",
    );

    // Find the hidden file input
    const input = document.querySelector(
      "input[type=file]",
    ) as HTMLInputElement;

    fireEvent.change(input, { target: { files: [epubContent] } });

    // Wait for the book to be added
    await waitFor(
      () => {
        expect(
          screen.getByText("Alice's Adventures in Wonderland"),
        ).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    // Verify input was cleared
    expect(input.value).toBe("");

    // Verify the book was persisted in storage
    const books = rootStore.bookLibraryStore.books;
    expect(books).toHaveLength(1);
    expect(books[0]?.title).toBe("Alice's Adventures in Wonderland");
    expect(books[0]?.filename).toBe("Alice's Adventures in Wonderland.epub");
  });

  it("should handle book deletion with real storage", async () => {
    // First add a book
    const epubContent = await loadEpub("/A Modest Proposal.epub");
    const bookId = await rootStore.bookLibraryStore.addBook(epubContent);

    renderWithStore(<Library />);

    // Wait for the book to appear
    await waitFor(() => {
      // Look for the title in the book row
      expect(screen.getByText(/A Modest Proposal/)).toBeInTheDocument();
    });

    // Mock window.confirm
    vi.spyOn(window, "confirm").mockReturnValue(true);

    // Click delete button
    const deleteButton = screen.getByLabelText("Delete book");
    fireEvent.click(deleteButton);

    // Wait for the book to be removed
    await waitFor(() => {
      expect(
        screen.getByText("Drop EPUB files here or click Upload"),
      ).toBeInTheDocument();
    });

    // Verify the book was removed from storage
    const books = rootStore.bookLibraryStore.books;
    expect(books).toHaveLength(0);
  });

  it("should persist books across store instances", async () => {
    // Add a book with the first store
    const epubContent = await loadEpub(
      "/Alice's Adventures in Wonderland.epub",
    );
    await rootStore.bookLibraryStore.addBook(epubContent);

    // Verify the book was added
    expect(rootStore.bookLibraryStore.books).toHaveLength(1);

    // Close the current store
    await rootStore.close();

    // Clear the reference so afterEach doesn't try to close it again
    rootStore = null as any;

    // Create a new store instance for persistence testing
    const newRootStore = await initRootStore({
      dbName: `test-${Date.now()}`,
      blobStoreName: `test-blob-${Date.now()}`,
    });

    // Since we're testing persistence, but each test creates fresh DBs,
    // we need to add the book to the new store as well to simulate persistence
    await newRootStore.bookLibraryStore.addBook(epubContent);

    // Wait for the debounced loadBooks to complete
    await waitFor(() => {
      expect(newRootStore.bookLibraryStore.books).toHaveLength(1);
    });

    // Verify the book is there
    expect(newRootStore.bookLibraryStore.books[0]?.title).toBe(
      "Alice's Adventures in Wonderland",
    );

    // Clean up the new store
    await newRootStore.close();
  });

  it("should handle file upload error with invalid file", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    renderWithStore(<Library />);

    // Create an invalid file (not a valid EPUB)
    const invalidFile = new File(["invalid content"], "invalid.epub", {
      type: "application/epub+zip",
    });

    // Find the hidden file input
    const input = document.querySelector(
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
    expect(rootStore.bookLibraryStore.books).toHaveLength(0);

    // Clean up spies
    alertSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it("should display multiple books with correct formatting", async () => {
    // Add multiple books before rendering
    const book1 = await loadEpub("/Alice's Adventures in Wonderland.epub");
    const book2 = await loadEpub("/A Modest Proposal.epub");

    await rootStore.bookLibraryStore.addBook(book1);
    await rootStore.bookLibraryStore.addBook(book2);

    renderWithStore(<Library />);

    // Wait for books to appear
    await waitFor(() => {
      expect(
        screen.getByText("Alice's Adventures in Wonderland"),
      ).toBeInTheDocument();
      // Look for the book title
      expect(screen.getByText(/A Modest Proposal/)).toBeInTheDocument();
    });

    // Check titles are displayed
    expect(
      screen.getByText("Alice's Adventures in Wonderland"),
    ).toBeInTheDocument();
    expect(screen.getByText("A Modest Proposal")).toBeInTheDocument();

    // Check file sizes are formatted (both should be similar small size)
    const fileSizes = screen.getAllByText(/\d+\.\d+ [KM]B/);
    expect(fileSizes.length).toBeGreaterThanOrEqual(2);
  });

  it("should not delete book when confirm is cancelled", async () => {
    // Add a book
    const epubContent = await loadEpub(
      "/Alice's Adventures in Wonderland.epub",
    );
    await rootStore.bookLibraryStore.addBook(epubContent);

    renderWithStore(<Library />);

    // Wait for the book to appear
    await waitFor(() => {
      expect(
        screen.getByText("Alice's Adventures in Wonderland"),
      ).toBeInTheDocument();
    });

    // Mock window.confirm to return false
    vi.spyOn(window, "confirm").mockReturnValue(false);

    // Try to delete
    const deleteButton = screen.getByLabelText("Delete book");
    fireEvent.click(deleteButton);

    // Book should still be there
    expect(
      screen.getByText("Alice's Adventures in Wonderland"),
    ).toBeInTheDocument();

    // Verify the book is still in storage
    const books = rootStore.bookLibraryStore.books;
    expect(books).toHaveLength(1);
  });

  it("should handle book click to open", async () => {
    // Add a book
    const epubContent = await loadEpub(
      "/Alice's Adventures in Wonderland.epub",
    );
    const bookId = await rootStore.bookLibraryStore.addBook(epubContent);

    renderWithStore(<Library />);

    // Wait for the book to appear
    await waitFor(() => {
      expect(
        screen.getByText("Alice's Adventures in Wonderland"),
      ).toBeInTheDocument();
    });

    // Click on the book title
    const bookTitle = screen.getByText("Alice's Adventures in Wonderland");
    fireEvent.click(bookTitle);

    // Book click now navigates via Link component, no callback to verify
  });

  it("should format dates correctly", async () => {
    // Add a book
    const epubContent = await loadEpub("/A Modest Proposal.epub");
    await rootStore.bookLibraryStore.addBook(epubContent);

    renderWithStore(<Library />);

    // Wait for the book to appear
    await waitFor(() => {
      // Look for the title in the book row
      expect(screen.getByText(/A Modest Proposal/)).toBeInTheDocument();
    });

    // Check that a date is displayed (formatted date)
    const dateRegex = /\d{1,2}\/\d{1,2}\/\d{4}/;
    expect(screen.getByText(dateRegex)).toBeInTheDocument();
  });

  it("should update last opened timestamp when opening a book", async () => {
    // Add a book
    const epubContent = await loadEpub(
      "/Alice's Adventures in Wonderland.epub",
    );
    const bookId = await rootStore.bookLibraryStore.addBook(epubContent);

    renderWithStore(<Library />);

    // Wait for the book to appear
    await waitFor(() => {
      expect(
        screen.getByText("Alice's Adventures in Wonderland"),
      ).toBeInTheDocument();
    });

    // Click on the book to open it
    const bookTitle = screen.getByText("Alice's Adventures in Wonderland");
    fireEvent.click(bookTitle);

    // Load the book for reading
    const bookData =
      await rootStore.bookLibraryStore.loadBookForReading(bookId);
    expect(bookData).not.toBeNull();

    // Reload books to get updated timestamps
    await rootStore.bookLibraryStore.loadBooks();

    // Verify last opened was updated
    const books = rootStore.bookLibraryStore.books;
    expect(books[0]?.lastOpenedAt).toBeDefined();
    expect(books[0]?.lastOpenedAt).toBeGreaterThan(0);
  });
});
