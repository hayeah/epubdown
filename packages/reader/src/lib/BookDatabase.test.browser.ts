import { createSqliteDatabase } from "@hayeah/sqlite-browser";
import type { SQLiteDBWrapper } from "@hayeah/sqlite-browser";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BookDatabase, type BookMetadata } from "./BookDatabase";

describe("BookDatabase", () => {
  let db: SQLiteDBWrapper;
  let bookDatabase: BookDatabase;

  beforeEach(async () => {
    // Create a fresh in-memory database for each test
    const sqliteDb = await createSqliteDatabase({
      databaseName: ":memory:",
      storeName: "test-db",
      useIndexedDB: false,
    });
    db = sqliteDb.db;
    bookDatabase = await BookDatabase.create(db);
  });

  afterEach(async () => {
    // Clean up - nothing needed for in-memory database
  });

  describe("create", () => {
    it("should create a BookDatabase instance with proper schema", async () => {
      expect(bookDatabase).toBeInstanceOf(BookDatabase);

      // Verify tables were created
      const tableResult = await db.query(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='books'",
      );
      expect(tableResult.rows.length).toBe(1);
      expect(tableResult.rows[0].name).toBe("books");

      // Verify indexes were created
      const indexResult = await db.query(
        "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_books_%'",
      );
      expect(indexResult.rows.length).toBe(4);
      const indexNames = indexResult.rows.map((row: any) => row.name);
      expect(indexNames).toContain("idx_books_added_at");
      expect(indexNames).toContain("idx_books_last_opened_at");
      expect(indexNames).toContain("idx_books_title");
      expect(indexNames).toContain("idx_books_author");
    });
  });

  describe("addBook", () => {
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

      // Verify the book was inserted
      const result = await db.query("SELECT * FROM books WHERE id = ?", [
        "test-book",
      ]);
      expect(result.rows.length).toBe(1);

      const insertedBook = result.rows[0];
      expect(insertedBook.id).toBe("test-book");
      expect(insertedBook.title).toBe("Test Book");
      expect(insertedBook.author).toBe("Test Author");
      expect(insertedBook.publisher).toBe("Test Publisher");
      expect(insertedBook.published_date).toBe("2024-01-01");
      expect(insertedBook.language).toBe("en");
      expect(insertedBook.identifier).toBe("ISBN123");
      expect(insertedBook.description).toBe("A test book");
      expect(insertedBook.cover_image_url).toBe("cover.jpg");
      expect(insertedBook.file_size).toBe(1024);
      expect(insertedBook.blob_store_key).toBe("book-test-book");
      expect(insertedBook.added_at).toBeGreaterThan(0);
    });

    it("should handle optional fields as null", async () => {
      const book = {
        id: "minimal-book",
        title: "Minimal Book",
        blobStoreKey: "book-minimal-book",
      };

      await bookDatabase.addBook(book);

      const result = await db.query("SELECT * FROM books WHERE id = ?", [
        "minimal-book",
      ]);
      const insertedBook = result.rows[0];

      expect(insertedBook.title).toBe("Minimal Book");
      expect(insertedBook.author).toBeNull();
      expect(insertedBook.publisher).toBeNull();
      expect(insertedBook.published_date).toBeNull();
      expect(insertedBook.language).toBeNull();
      expect(insertedBook.identifier).toBeNull();
      expect(insertedBook.description).toBeNull();
      expect(insertedBook.cover_image_url).toBeNull();
      expect(insertedBook.file_size).toBeNull();
    });
  });

  describe("getBook", () => {
    beforeEach(async () => {
      // Insert test data
      await bookDatabase.addBook({
        id: "test-book",
        title: "Test Book",
        author: "Test Author",
        blobStoreKey: "book-test-book",
      });
    });

    it("should retrieve a book by id", async () => {
      const result = await bookDatabase.getBook("test-book");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("test-book");
      expect(result?.title).toBe("Test Book");
      expect(result?.author).toBe("Test Author");
      expect(result?.blobStoreKey).toBe("book-test-book");
      expect(result?.readingProgress).toBe(0);
      expect(result?.currentChapter).toBe(0);
    });

    it("should return null if book not found", async () => {
      const result = await bookDatabase.getBook("non-existent");
      expect(result).toBeNull();
    });
  });

  describe("getAllBooks", () => {
    beforeEach(async () => {
      // Insert multiple books with different timestamps
      await bookDatabase.addBook({
        id: "book1",
        title: "Book 1",
        blobStoreKey: "book-book1",
      });

      // Small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));

      await bookDatabase.addBook({
        id: "book2",
        title: "Book 2",
        blobStoreKey: "book-book2",
      });
    });

    it("should retrieve all books ordered by addedAt desc", async () => {
      const result = await bookDatabase.getAllBooks();

      expect(result).toHaveLength(2);
      // Book 2 should come first (added more recently)
      expect(result[0].id).toBe("book2");
      expect(result[0].title).toBe("Book 2");
      expect(result[1].id).toBe("book1");
      expect(result[1].title).toBe("Book 1");
    });
  });

  describe("updateLastOpened", () => {
    beforeEach(async () => {
      await bookDatabase.addBook({
        id: "test-book",
        title: "Test Book",
        blobStoreKey: "book-test-book",
      });
    });

    it("should update last opened timestamp", async () => {
      const beforeUpdate = await bookDatabase.getBook("test-book");
      expect(beforeUpdate?.lastOpenedAt).toBeNull();

      await bookDatabase.updateLastOpened("test-book");

      const afterUpdate = await bookDatabase.getBook("test-book");
      expect(afterUpdate?.lastOpenedAt).toBeGreaterThan(0);
      expect(afterUpdate?.lastOpenedAt).toBeLessThanOrEqual(Date.now());
    });
  });

  describe("updateReadingProgress", () => {
    beforeEach(async () => {
      await bookDatabase.addBook({
        id: "test-book",
        title: "Test Book",
        blobStoreKey: "book-test-book",
      });
    });

    it("should update reading progress and current chapter", async () => {
      await bookDatabase.updateReadingProgress("test-book", 0.75, 5);

      const book = await bookDatabase.getBook("test-book");
      expect(book?.readingProgress).toBe(0.75);
      expect(book?.currentChapter).toBe(5);
    });
  });

  describe("deleteBook", () => {
    beforeEach(async () => {
      await bookDatabase.addBook({
        id: "test-book",
        title: "Test Book",
        blobStoreKey: "book-test-book",
      });
    });

    it("should delete a book by id", async () => {
      // Verify book exists
      const beforeDelete = await bookDatabase.getBook("test-book");
      expect(beforeDelete).not.toBeNull();

      await bookDatabase.deleteBook("test-book");

      // Verify book is deleted
      const afterDelete = await bookDatabase.getBook("test-book");
      expect(afterDelete).toBeNull();
    });

    it("should not throw error when deleting non-existent book", async () => {
      await expect(
        bookDatabase.deleteBook("non-existent"),
      ).resolves.not.toThrow();
    });
  });
});
