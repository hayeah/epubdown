import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BookMetadata } from "../lib/BookDatabase";
import { BookLibraryStore } from "../stores/BookLibraryStore";
import { type RootStore, StoreProvider } from "../stores/RootStore";
import { BookLibrary } from "./BookLibrary";

// Mock BookStorage to avoid database initialization
vi.mock("../lib/BookStorage", () => ({
  BookStorage: vi.fn().mockImplementation(() => ({
    getAllBooks: vi.fn().mockResolvedValue([]),
    addBook: vi.fn(),
    deleteBook: vi.fn(),
    getBook: vi.fn(),
    updateLastOpened: vi.fn(),
  })),
}));

describe("BookLibrary", () => {
  let rootStore: RootStore;
  let mockOnOpenBook: ReturnType<typeof vi.fn>;
  let bookLibraryStore: BookLibraryStore;

  beforeEach(() => {
    vi.clearAllMocks();
    bookLibraryStore = new BookLibraryStore();
    // Override the automatic loading in constructor
    bookLibraryStore.isLoading = false;
    bookLibraryStore.books = [];

    rootStore = {
      bookLibraryStore,
    } as RootStore;

    mockOnOpenBook = vi.fn();
  });

  const renderWithStore = (component: React.ReactElement) => {
    return render(<StoreProvider value={rootStore}>{component}</StoreProvider>);
  };

  it("should display empty state when no books", () => {
    renderWithStore(<BookLibrary onOpenBook={mockOnOpenBook} />);

    expect(
      screen.getByText("No books in your library yet"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Upload an EPUB file to get started"),
    ).toBeInTheDocument();
  });

  it("should display loading state", async () => {
    // Make loadBooks slow
    rootStore.bookLibraryStore.isLoading = true;

    renderWithStore(<BookLibrary onOpenBook={mockOnOpenBook} />);

    expect(screen.getByText("Loading library...")).toBeInTheDocument();
  });

  it("should display books list", () => {
    const mockBooks: BookMetadata[] = [
      {
        id: "book-1",
        title: "Test Book 1",
        filename: "test-book-1.epub",
        fileSize: 1024 * 1024 * 2, // 2MB
        createdAt: Date.now() - 86400000, // 1 day ago
        lastOpenedAt: Date.now() - 3600000, // 1 hour ago
      },
      {
        id: "book-2",
        title: "Test Book 2",
        filename: "test-book-2.epub",
        fileSize: 1024 * 1024 * 5, // 5MB
        createdAt: Date.now() - 172800000, // 2 days ago
      },
    ];

    bookLibraryStore.books = mockBooks;

    renderWithStore(<BookLibrary onOpenBook={mockOnOpenBook} />);

    // Check first book
    expect(screen.getByText("Test Book 1")).toBeInTheDocument();
    expect(screen.getByText("test-book-1.epub")).toBeInTheDocument();
    expect(screen.getByText("2.0 MB")).toBeInTheDocument();

    // Check second book
    expect(screen.getByText("Test Book 2")).toBeInTheDocument();
    expect(screen.getByText("test-book-2.epub")).toBeInTheDocument();
    expect(screen.getByText("5.0 MB")).toBeInTheDocument();
  });

  it("should handle book click to open", () => {
    const mockBooks: BookMetadata[] = [
      {
        id: "book-1",
        title: "Test Book 1",
        filename: "test-book-1.epub",
        fileSize: 1024 * 1024,
        createdAt: Date.now(),
      },
    ];

    bookLibraryStore.books = mockBooks;

    renderWithStore(<BookLibrary onOpenBook={mockOnOpenBook} />);

    const bookTitle = screen.getByText("Test Book 1");
    fireEvent.click(bookTitle);

    expect(mockOnOpenBook).toHaveBeenCalledWith("book-1");
  });

  it("should handle book deletion", async () => {
    const mockBooks: BookMetadata[] = [
      {
        id: "book-1",
        title: "Test Book 1",
        filename: "test-book-1.epub",
        fileSize: 1024 * 1024,
        createdAt: Date.now(),
      },
    ];

    bookLibraryStore.books = mockBooks;
    const deleteBookSpy = vi
      .spyOn(rootStore.bookLibraryStore, "deleteBook")
      .mockResolvedValue();

    // Mock window.confirm
    vi.spyOn(window, "confirm").mockReturnValue(true);

    renderWithStore(<BookLibrary onOpenBook={mockOnOpenBook} />);

    const deleteButton = screen.getByText("Delete");
    fireEvent.click(deleteButton);

    expect(window.confirm).toHaveBeenCalledWith(
      "Are you sure you want to delete this book?",
    );
    expect(deleteBookSpy).toHaveBeenCalledWith("book-1");
  });

  it("should not delete book when confirm is cancelled", () => {
    const mockBooks: BookMetadata[] = [
      {
        id: "book-1",
        title: "Test Book 1",
        filename: "test-book-1.epub",
        fileSize: 1024 * 1024,
        createdAt: Date.now(),
      },
    ];

    bookLibraryStore.books = mockBooks;
    const deleteBookSpy = vi.spyOn(rootStore.bookLibraryStore, "deleteBook");

    // Mock window.confirm to return false
    vi.spyOn(window, "confirm").mockReturnValue(false);

    renderWithStore(<BookLibrary onOpenBook={mockOnOpenBook} />);

    const deleteButton = screen.getByText("Delete");
    fireEvent.click(deleteButton);

    expect(window.confirm).toHaveBeenCalled();
    expect(deleteBookSpy).not.toHaveBeenCalled();
  });

  it("should handle file upload", async () => {
    const addBookSpy = vi
      .spyOn(rootStore.bookLibraryStore, "addBook")
      .mockResolvedValue("new-book-id");

    renderWithStore(<BookLibrary onOpenBook={mockOnOpenBook} />);

    const file = new File(["test content"], "test.epub", {
      type: "application/epub+zip",
    });
    const input = screen
      .getByLabelText(/click to upload/i)
      .closest("label")
      ?.querySelector("input[type=file]") as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(addBookSpy).toHaveBeenCalledWith(file);
    });

    // Check that input was cleared
    expect(input.value).toBe("");
  });

  it("should handle file upload error", async () => {
    const error = new Error("Failed to parse EPUB");
    const addBookSpy = vi
      .spyOn(rootStore.bookLibraryStore, "addBook")
      .mockRejectedValue(error);
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    renderWithStore(<BookLibrary onOpenBook={mockOnOpenBook} />);

    const file = new File(["test content"], "test.epub", {
      type: "application/epub+zip",
    });
    const input = screen
      .getByLabelText(/click to upload/i)
      .closest("label")
      ?.querySelector("input[type=file]") as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to add book:",
        error,
      );
      expect(alertSpy).toHaveBeenCalledWith(
        "Failed to add book: Failed to parse EPUB",
      );
    });
  });

  it("should format dates correctly", () => {
    const mockBooks: BookMetadata[] = [
      {
        id: "book-1",
        title: "Test Book",
        filename: "test.epub",
        fileSize: 1024 * 1024,
        createdAt: new Date("2024-01-15").getTime(),
        lastOpenedAt: new Date("2024-01-20").getTime(),
      },
    ];

    bookLibraryStore.books = mockBooks;

    renderWithStore(<BookLibrary onOpenBook={mockOnOpenBook} />);

    // These will show in local date format
    expect(screen.getByText(/Added:/)).toBeInTheDocument();
    expect(screen.getByText(/Last opened:/)).toBeInTheDocument();
  });
});
