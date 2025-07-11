import { Migrator } from "@hayeah/sqlite-browser";
import type { SQLiteDBWrapper } from "@hayeah/sqlite-browser";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BookDatabase, type BookMetadata } from "./BookDatabase";

vi.mock("@hayeah/sqlite-browser");

describe("BookDatabase", () => {
  let mockDb: SQLiteDBWrapper;
  let mockMigrator: Migrator;
  let bookDatabase: BookDatabase;

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = {
      query: vi.fn(),
    } as any;

    mockMigrator = {
      up: vi.fn(),
    } as any;

    vi.mocked(Migrator).mockReturnValue(mockMigrator);
  });

  describe("create", () => {
    it("should create a BookDatabase instance and run migrations", async () => {
      bookDatabase = await BookDatabase.create(mockDb);

      expect(Migrator).toHaveBeenCalledWith(mockDb);
      expect(mockMigrator.up).toHaveBeenCalledWith([
        {
          name: "001_create_books_table",
          up: expect.stringContaining("CREATE TABLE IF NOT EXISTS books"),
        },
      ]);
      expect(bookDatabase).toBeInstanceOf(BookDatabase);
    });

    it("should create proper indexes", async () => {
      await BookDatabase.create(mockDb);

      const migration = vi.mocked(mockMigrator.up).mock.calls[0][0][0].up;
      expect(migration).toContain(
        "CREATE INDEX IF NOT EXISTS idx_books_added_at",
      );
      expect(migration).toContain(
        "CREATE INDEX IF NOT EXISTS idx_books_last_opened_at",
      );
      expect(migration).toContain("CREATE INDEX IF NOT EXISTS idx_books_title");
      expect(migration).toContain(
        "CREATE INDEX IF NOT EXISTS idx_books_author",
      );
    });
  });

  describe("addBook", () => {
    beforeEach(async () => {
      bookDatabase = await BookDatabase.create(mockDb);
    });

    it("should insert a book with all fields", async () => {
      const book = {
        id: "test-book",
        title: "Test Book",
        author: "Test Author",
        publisher: "Test Publisher",
        publishedDate: "2024-01-01",
        language: "en",
        identifier: "ISBN123",
        description: "A test book",
        coverImageUrl: "cover.jpg",
        fileSize: 1024,
        blobStoreKey: "book-test-book",
      };

      await bookDatabase.addBook(book);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO books"),
        [
          "test-book",
          "Test Book",
          "Test Author",
          "Test Publisher",
          "2024-01-01",
          "en",
          "ISBN123",
          "A test book",
          "cover.jpg",
          1024,
          expect.any(Number), // addedAt timestamp
          "book-test-book",
        ],
      );
    });

    it("should handle optional fields as null", async () => {
      const book = {
        id: "minimal-book",
        title: "Minimal Book",
        blobStoreKey: "book-minimal-book",
      };

      await bookDatabase.addBook(book);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO books"),
        [
          "minimal-book",
          "Minimal Book",
          null, // author
          null, // publisher
          null, // publishedDate
          null, // language
          null, // identifier
          null, // description
          null, // coverImageUrl
          null, // fileSize
          expect.any(Number), // addedAt
          "book-minimal-book",
        ],
      );
    });
  });

  describe("getBook", () => {
    beforeEach(async () => {
      bookDatabase = await BookDatabase.create(mockDb);
    });

    it("should retrieve a book by id", async () => {
      const mockRow = {
        id: "test-book",
        title: "Test Book",
        author: "Test Author",
        publisher: "Test Publisher",
        published_date: "2024-01-01",
        language: "en",
        identifier: "ISBN123",
        description: "A test book",
        cover_image_url: "cover.jpg",
        file_size: 1024,
        added_at: 1234567890,
        last_opened_at: 1234567900,
        reading_progress: 0.5,
        current_chapter: 3,
        blob_store_key: "book-test-book",
      };

      vi.mocked(mockDb.query).mockResolvedValue({
        rows: [mockRow],
      } as any);

      const result = await bookDatabase.getBook("test-book");

      expect(mockDb.query).toHaveBeenCalledWith(
        "SELECT * FROM books WHERE id = ?",
        ["test-book"],
      );

      expect(result).toEqual({
        id: "test-book",
        title: "Test Book",
        author: "Test Author",
        publisher: "Test Publisher",
        publishedDate: "2024-01-01",
        language: "en",
        identifier: "ISBN123",
        description: "A test book",
        coverImageUrl: "cover.jpg",
        fileSize: 1024,
        addedAt: 1234567890,
        lastOpenedAt: 1234567900,
        readingProgress: 0.5,
        currentChapter: 3,
        blobStoreKey: "book-test-book",
      });
    });

    it("should return null if book not found", async () => {
      vi.mocked(mockDb.query).mockResolvedValue({
        rows: [],
      } as any);

      const result = await bookDatabase.getBook("non-existent");

      expect(result).toBeNull();
    });
  });

  describe("getAllBooks", () => {
    beforeEach(async () => {
      bookDatabase = await BookDatabase.create(mockDb);
    });

    it("should retrieve all books ordered by addedAt desc", async () => {
      const mockRows = [
        {
          id: "book1",
          title: "Book 1",
          added_at: 1234567890,
          blob_store_key: "book-book1",
        },
        {
          id: "book2",
          title: "Book 2",
          added_at: 1234567880,
          blob_store_key: "book-book2",
        },
      ];

      vi.mocked(mockDb.query).mockResolvedValue({
        rows: mockRows,
      } as any);

      const result = await bookDatabase.getAllBooks();

      expect(mockDb.query).toHaveBeenCalledWith(
        "SELECT * FROM books ORDER BY added_at DESC",
      );

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("book1");
      expect(result[1].id).toBe("book2");
    });
  });

  describe("updateLastOpened", () => {
    beforeEach(async () => {
      bookDatabase = await BookDatabase.create(mockDb);
    });

    it("should update last opened timestamp", async () => {
      await bookDatabase.updateLastOpened("test-book");

      expect(mockDb.query).toHaveBeenCalledWith(
        "UPDATE books SET last_opened_at = ? WHERE id = ?",
        [expect.any(Number), "test-book"],
      );
    });
  });

  describe("updateReadingProgress", () => {
    beforeEach(async () => {
      bookDatabase = await BookDatabase.create(mockDb);
    });

    it("should update reading progress and current chapter", async () => {
      await bookDatabase.updateReadingProgress("test-book", 0.75, 5);

      expect(mockDb.query).toHaveBeenCalledWith(
        "UPDATE books SET reading_progress = ?, current_chapter = ? WHERE id = ?",
        [0.75, 5, "test-book"],
      );
    });
  });

  describe("deleteBook", () => {
    beforeEach(async () => {
      bookDatabase = await BookDatabase.create(mockDb);
    });

    it("should delete a book by id", async () => {
      await bookDatabase.deleteBook("test-book");

      expect(mockDb.query).toHaveBeenCalledWith(
        "DELETE FROM books WHERE id = ?",
        ["test-book"],
      );
    });
  });
});
