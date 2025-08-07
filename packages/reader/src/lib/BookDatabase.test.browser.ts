import type { SQLiteDB } from "@hayeah/sqlite-browser";
/**
 * @vitest-environment browser
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { nukeIndexedDBDatabases } from "../stores/testUtils";
import { BookDatabase } from "./BookDatabase";
import { getDb } from "./DatabaseProvider";

describe("BookDatabase", () => {
  let bookDatabase: BookDatabase;
  let db: SQLiteDB;

  beforeEach(async () => {
    // Clear IndexedDB before each test
    await nukeIndexedDBDatabases();

    // Create fresh database for each test
    db = await getDb(`test-${Date.now()}`);
    bookDatabase = await BookDatabase.create(db);
  });

  afterEach(async () => {
    await db.close();
  });

  describe("addBook", () => {
    it("should add a book with metadata", async () => {
      const testMetadata = new Uint8Array([1, 2, 3, 4, 5]);

      const bookId = await bookDatabase.addBook({
        title: "Test Book",
        filename: "test-book.epub",
        fileSize: 1024,
        metadata: testMetadata,
      });

      // Verify the book was added
      const result = await db.query("SELECT * FROM books WHERE id = ?", [
        bookId,
      ]);

      expect(result.rows.length).toBe(1);
      const row = result.rows[0];
      expect(row.title).toBe("Test Book");
      expect(row.filename).toBe("test-book.epub");
      expect(row.file_size).toBe(1024);
      expect(row.created_at).toBeDefined();
    });

    it("should add a book without metadata", async () => {
      const bookId = await bookDatabase.addBook({
        title: "Test Book",
        filename: "test-book.epub",
        fileSize: 1024,
      });

      const result = await db.query("SELECT * FROM books WHERE id = ?", [
        bookId,
      ]);

      expect(result.rows.length).toBe(1);
      const row = result.rows[0];
      expect(row.title).toBe("Test Book");
      expect(row.metadata).toBeNull();
    });

    it("should handle books with same title", async () => {
      const bookId1 = await bookDatabase.addBook({
        title: "Duplicate Title",
        filename: "book1.epub",
        fileSize: 1024,
      });

      const bookId2 = await bookDatabase.addBook({
        title: "Duplicate Title",
        filename: "book2.epub",
        fileSize: 2048,
      });

      // Both should be added with different IDs
      expect(bookId1).not.toBe(bookId2);

      const result = await db.query(
        "SELECT * FROM books WHERE title = ? ORDER BY id",
        ["Duplicate Title"],
      );
      expect(result.rows.length).toBe(2);
    });
  });

  describe("getBook", () => {
    let testBookId: number;

    beforeEach(async () => {
      // Insert test data
      testBookId = await bookDatabase.addBook({
        title: "Test Book",
        filename: "test-book.epub",
        fileSize: 1024,
      });
    });

    it("should retrieve a book by id", async () => {
      const result = await bookDatabase.getBook(testBookId);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(testBookId);
      expect(result?.title).toBe("Test Book");
      expect(result?.fileSize).toBe(1024);
    });

    it("should return null if book not found", async () => {
      const result = await bookDatabase.getBook(999999);
      expect(result).toBeNull();
    });
  });

  describe("getAllBooks", () => {
    let bookId1: number;
    let bookId2: number;

    beforeEach(async () => {
      // Insert multiple books with different timestamps
      bookId1 = await bookDatabase.addBook({
        title: "Book 1",
        filename: "book1.epub",
        fileSize: 1024,
      });

      // Small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));

      bookId2 = await bookDatabase.addBook({
        title: "Book 2",
        filename: "book2.epub",
        fileSize: 2048,
      });
    });

    it("should retrieve all books ordered by createdAt desc", async () => {
      const result = await bookDatabase.getAllBooks();

      expect(result).toHaveLength(2);
      // Book 2 should come first (added more recently)
      expect(result[0]?.id).toBe(bookId2);
      expect(result[0]?.title).toBe("Book 2");
      expect(result[1]?.id).toBe(bookId1);
      expect(result[1]?.title).toBe("Book 1");
    });
  });

  describe("updateLastOpened", () => {
    let testBookId: number;

    beforeEach(async () => {
      testBookId = await bookDatabase.addBook({
        title: "Test Book",
        filename: "test-book.epub",
        fileSize: 1024,
      });
    });

    it("should update last opened timestamp", async () => {
      await bookDatabase.updateLastOpened(testBookId);

      // Verify the update
      const book = await bookDatabase.getBook(testBookId);
      expect(book?.lastOpenedAt).toBeDefined();
      expect(book?.lastOpenedAt).toBeGreaterThan(0);
    });
  });

  describe("deleteBook", () => {
    let testBookId: number;

    beforeEach(async () => {
      testBookId = await bookDatabase.addBook({
        title: "Test Book",
        filename: "test-book.epub",
        fileSize: 1024,
      });
    });

    it("should delete a book", async () => {
      await bookDatabase.deleteBook(testBookId);

      // Verify deletion
      const book = await bookDatabase.getBook(testBookId);
      expect(book).toBeNull();
    });

    it("should not error when deleting non-existent book", async () => {
      // Should not throw
      await expect(bookDatabase.deleteBook(999999)).resolves.toBeUndefined();
    });
  });

  describe("searchBooks", () => {
    beforeEach(async () => {
      // Insert test books
      await bookDatabase.addBook({
        title: "JavaScript: The Good Parts",
        filename: "js-good-parts.epub",
        fileSize: 1024,
      });

      await bookDatabase.addBook({
        title: "Python Programming",
        filename: "python-prog.epub",
        fileSize: 2048,
      });

      await bookDatabase.addBook({
        title: "Learning JavaScript",
        filename: "learning-js.epub",
        fileSize: 3072,
      });
    });

    it("should find books matching search query", async () => {
      const result = await bookDatabase.searchBooks("javascript");

      expect(result).toHaveLength(2);
      expect(result[0]?.title).toContain("JavaScript");
      expect(result[1]?.title).toContain("JavaScript");
    });

    it("should return all books for empty query", async () => {
      const result = await bookDatabase.searchBooks("");

      expect(result).toHaveLength(3);
    });

    it("should handle case-insensitive search", async () => {
      const result = await bookDatabase.searchBooks("PYTHON");

      expect(result).toHaveLength(1);
      expect(result[0]?.title).toBe("Python Programming");
    });

    it("should return empty array for non-matching query", async () => {
      const result = await bookDatabase.searchBooks("Rust");

      expect(result).toHaveLength(0);
    });
  });

  describe("metadata handling", () => {
    it("should properly encode and decode Uint8Array metadata", async () => {
      const testMetadata = new Uint8Array([255, 128, 0, 42, 17]);

      const bookId = await bookDatabase.addBook({
        title: "Book with Metadata",
        filename: "metadata-test.epub",
        fileSize: 1024,
        metadata: testMetadata,
      });

      const retrieved = await bookDatabase.getBook(bookId);

      expect(retrieved?.metadata).toBeDefined();
      expect(retrieved?.metadata).toBeInstanceOf(Uint8Array);
      expect(retrieved?.metadata).toEqual(testMetadata);
    });
  });
});
