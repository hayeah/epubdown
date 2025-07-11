import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BookMetadata } from "../lib/BookDatabase";
import { BookLibraryStore } from "../stores/BookLibraryStore";
import { type RootStore, StoreProvider } from "../stores/RootStore";
import { BookLibrary } from "./BookLibrary";

describe("BookLibrary (Browser)", () => {
  let rootStore: RootStore;
  let mockOnOpenBook: ReturnType<typeof vi.fn>;
  let bookLibraryStore: BookLibraryStore;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Clear all IndexedDB databases before each test
    const databases = await indexedDB.databases();
    for (const db of databases) {
      if (db.name) {
        indexedDB.deleteDatabase(db.name);
      }
    }

    // Create real BookLibraryStore with real storage
    bookLibraryStore = new BookLibraryStore();

    // Wait for initial load to complete
    await waitFor(() => {
      expect(bookLibraryStore.isLoading).toBe(false);
    });

    rootStore = {
      bookLibraryStore,
    } as RootStore;

    mockOnOpenBook = vi.fn();
  });

  afterEach(async () => {
    // Clean up IndexedDB after each test
    const databases = await indexedDB.databases();
    for (const db of databases) {
      if (db.name) {
        indexedDB.deleteDatabase(db.name);
      }
    }
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

  it("should display loading state", async () => {
    // Create a new store and immediately render while it's loading
    const loadingStore = new BookLibraryStore();
    const loadingRootStore = {
      bookLibraryStore: loadingStore,
    } as RootStore;

    render(
      <StoreProvider value={loadingRootStore}>
        <BookLibrary onOpenBook={mockOnOpenBook} />
      </StoreProvider>,
    );

    expect(screen.getByText("Loading library...")).toBeInTheDocument();

    // Wait for loading to complete
    await waitFor(() => {
      expect(loadingStore.isLoading).toBe(false);
    });
  });

  it("should handle file upload with real storage", async () => {
    renderWithStore(<BookLibrary onOpenBook={mockOnOpenBook} />);

    // Create a mock EPUB file with minimal valid structure
    const epubContent = await createMockEpubFile("Test Book", "test-book.epub");

    const input = screen
      .getByLabelText(/click to upload/i)
      .closest("label")
      ?.querySelector("input[type=file]") as HTMLInputElement;

    fireEvent.change(input, { target: { files: [epubContent] } });

    // Wait for the book to be added
    await waitFor(
      () => {
        expect(screen.getByText("Test Book")).toBeInTheDocument();
        expect(screen.getByText("test-book.epub")).toBeInTheDocument();
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
      expect(books[0].title).toBe("Test Book");
      expect(books[0].filename).toBe("test-book.epub");
    }
  });

  it("should handle book deletion with real storage", async () => {
    renderWithStore(<BookLibrary onOpenBook={mockOnOpenBook} />);

    // First add a book
    const epubContent = await createMockEpubFile(
      "Book to Delete",
      "delete-me.epub",
    );
    const bookId = await bookLibraryStore.addBook(epubContent);

    // Wait for the book to appear
    await waitFor(() => {
      expect(screen.getByText("Book to Delete")).toBeInTheDocument();
    });

    // Mock window.confirm
    vi.spyOn(window, "confirm").mockReturnValue(true);

    // Click delete button
    const deleteButton = screen.getByText("Delete");
    fireEvent.click(deleteButton);

    // Wait for the book to be removed
    await waitFor(() => {
      expect(screen.queryByText("Book to Delete")).not.toBeInTheDocument();
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
    const epubContent = await createMockEpubFile(
      "Persistent Book",
      "persist.epub",
    );
    await bookLibraryStore.addBook(epubContent);

    // Create a new store instance
    const newStore = new BookLibraryStore();

    // Wait for it to load
    await waitFor(() => {
      expect(newStore.isLoading).toBe(false);
    });

    // Verify the book is still there
    expect(newStore.books).toHaveLength(1);
    expect(newStore.books[0].title).toBe("Persistent Book");
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

    const input = screen
      .getByLabelText(/click to upload/i)
      .closest("label")
      ?.querySelector("input[type=file]") as HTMLInputElement;

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
  });

  it("should update last opened timestamp when opening a book", async () => {
    renderWithStore(<BookLibrary onOpenBook={mockOnOpenBook} />);

    // Add a book
    const epubContent = await createMockEpubFile(
      "Book to Open",
      "open-me.epub",
    );
    const bookId = await bookLibraryStore.addBook(epubContent);

    // Wait for the book to appear
    await waitFor(() => {
      expect(screen.getByText("Book to Open")).toBeInTheDocument();
    });

    // Click on the book to open it
    const bookTitle = screen.getByText("Book to Open");
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

// Helper function to create a minimal valid EPUB file
async function createMockEpubFile(
  title: string,
  filename: string,
): Promise<File> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();

  // Add mimetype
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });

  // Add container.xml
  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`,
  );

  // Add content.opf
  zip.file(
    "content.opf",
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>${title}</dc:title>
    <dc:identifier id="uid">test-book-id</dc:identifier>
    <dc:language>en</dc:language>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="chapter1"/>
  </spine>
</package>`,
  );

  // Add navigation
  zip.file(
    "nav.xhtml",
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>Navigation</title></head>
<body>
  <nav epub:type="toc">
    <ol>
      <li><a href="chapter1.xhtml">Chapter 1</a></li>
    </ol>
  </nav>
</body>
</html>`,
  );

  // Add a chapter
  zip.file(
    "chapter1.xhtml",
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Chapter 1</title></head>
<body>
  <h1>Chapter 1</h1>
  <p>This is the content of chapter 1.</p>
</body>
</html>`,
  );

  const blob = await zip.generateAsync({ type: "blob" });
  return new File([blob], filename, { type: "application/epub+zip" });
}
