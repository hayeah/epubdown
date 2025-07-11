import type { EPub } from "@epubdown/core";
import { createSqliteDatabase } from "@hayeah/sqlite-browser";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BlobStore } from "./BlobStore";
import { BookDatabase } from "./BookDatabase";
import { BookStorage, type StoredBook } from "./BookStorage";

vi.mock("./BlobStore");
vi.mock("./BookDatabase");
vi.mock("@hayeah/sqlite-browser");

describe("BookStorage", () => {
  let mockBlobStore: BlobStore;
  let mockBookDb: BookDatabase;
  let bookStorage: BookStorage;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockBlobStore = {
      put: vi.fn(),
      getBlob: vi.fn(),
      delete: vi.fn(),
    } as any;

    mockBookDb = {
      addBook: vi.fn(),
      getBook: vi.fn(),
      getAllBooks: vi.fn(),
      deleteBook: vi.fn(),
      updateLastOpened: vi.fn(),
      updateReadingProgress: vi.fn(),
    } as any;

    vi.mocked(createSqliteDatabase).mockResolvedValue({
      db: {} as any,
    } as any);

    vi.mocked(BlobStore.create).mockResolvedValue(mockBlobStore);
    vi.mocked(BookDatabase.create).mockResolvedValue(mockBookDb);
  });

  describe("create", () => {
    it("should create a BookStorage instance with initialized dependencies", async () => {
      bookStorage = await BookStorage.create();

      expect(createSqliteDatabase).toHaveBeenCalledWith({
        databaseName: "epubdown.db",
        storeName: "epubdown-sqlite",
        useIndexedDB: true,
      });

      expect(BlobStore.create).toHaveBeenCalledWith({
        dbName: "epubdown-books",
        storeName: "books",
      });

      expect(BookDatabase.create).toHaveBeenCalledWith(expect.any(Object));
      expect(bookStorage).toBeInstanceOf(BookStorage);
    });
  });

  describe("addBook", () => {
    beforeEach(async () => {
      bookStorage = await BookStorage.create();
    });

    it("should add a book with metadata and blob", async () => {
      const mockFile = new File(["content"], "test-book.epub", {
        type: "application/epub+zip",
      });
      const mockEpub: EPub = {
        metadata: {
          title: "Test Book",
          creator: "Test Author",
          publisher: "Test Publisher",
          date: "2024-01-01",
          language: "en",
          identifier: "ISBN123",
          description: "Test description",
          cover: "cover.jpg",
        },
      } as any;

      const bookId = await bookStorage.addBook(mockFile, mockEpub);

      expect(bookId).toMatch(/^test-book-[a-z0-9]+$/);

      const blobStoreKey = `book-${bookId}`;
      expect(mockBlobStore.put).toHaveBeenCalledWith(blobStoreKey, mockFile);

      expect(mockBookDb.addBook).toHaveBeenCalledWith({
        id: bookId,
        title: "Test Book",
        author: "Test Author",
        publisher: "Test Publisher",
        publishedDate: "2024-01-01",
        language: "en",
        identifier: "ISBN123",
        description: "Test description",
        coverImageUrl: "cover.jpg",
        fileSize: mockFile.size,
        blobStoreKey,
      });
    });

    it("should use filename as title if metadata title is missing", async () => {
      const mockFile = new File(["content"], "my-ebook.epub");
      const mockEpub: EPub = {
        metadata: {},
      } as any;

      await bookStorage.addBook(mockFile, mockEpub);

      expect(mockBookDb.addBook).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "my-ebook.epub",
        }),
      );
    });
  });

  describe("getBook", () => {
    beforeEach(async () => {
      bookStorage = await BookStorage.create();
    });

    it("should retrieve a book with metadata and blob", async () => {
      const mockMetadata = {
        id: "test-id",
        title: "Test Book",
        blobStoreKey: "book-test-id",
      };
      const mockBlob = new Blob(["content"]);

      vi.mocked(mockBookDb.getBook).mockResolvedValue(mockMetadata as any);
      vi.mocked(mockBlobStore.getBlob).mockResolvedValue(mockBlob);

      const result = await bookStorage.getBook("test-id");

      expect(mockBookDb.getBook).toHaveBeenCalledWith("test-id");
      expect(mockBlobStore.getBlob).toHaveBeenCalledWith("book-test-id");
      expect(result).toEqual({
        ...mockMetadata,
        blob: mockBlob,
      });
    });

    it("should return null if book metadata not found", async () => {
      vi.mocked(mockBookDb.getBook).mockResolvedValue(null);

      const result = await bookStorage.getBook("non-existent");

      expect(result).toBeNull();
      expect(mockBlobStore.getBlob).not.toHaveBeenCalled();
    });

    it("should clean up metadata if blob is missing", async () => {
      const mockMetadata = {
        id: "test-id",
        blobStoreKey: "book-test-id",
      };

      vi.mocked(mockBookDb.getBook).mockResolvedValue(mockMetadata as any);
      vi.mocked(mockBlobStore.getBlob).mockResolvedValue(null);

      const result = await bookStorage.getBook("test-id");

      expect(result).toBeNull();
      expect(mockBookDb.deleteBook).toHaveBeenCalledWith("test-id");
    });
  });

  describe("getAllBooks", () => {
    beforeEach(async () => {
      bookStorage = await BookStorage.create();
    });

    it("should return all books from database", async () => {
      const mockBooks = [
        { id: "book1", title: "Book 1" },
        { id: "book2", title: "Book 2" },
      ];

      vi.mocked(mockBookDb.getAllBooks).mockResolvedValue(mockBooks as any);

      const result = await bookStorage.getAllBooks();

      expect(result).toEqual(mockBooks);
      expect(mockBookDb.getAllBooks).toHaveBeenCalled();
    });
  });

  describe("deleteBook", () => {
    beforeEach(async () => {
      bookStorage = await BookStorage.create();
    });

    it("should delete both blob and metadata", async () => {
      const mockBook = {
        id: "test-id",
        blobStoreKey: "book-test-id",
      };

      vi.mocked(mockBookDb.getBook).mockResolvedValue(mockBook as any);

      await bookStorage.deleteBook("test-id");

      expect(mockBlobStore.delete).toHaveBeenCalledWith("book-test-id");
      expect(mockBookDb.deleteBook).toHaveBeenCalledWith("test-id");
    });

    it("should do nothing if book not found", async () => {
      vi.mocked(mockBookDb.getBook).mockResolvedValue(null);

      await bookStorage.deleteBook("non-existent");

      expect(mockBlobStore.delete).not.toHaveBeenCalled();
      expect(mockBookDb.deleteBook).not.toHaveBeenCalled();
    });
  });

  describe("updateLastOpened", () => {
    beforeEach(async () => {
      bookStorage = await BookStorage.create();
    });

    it("should update last opened timestamp", async () => {
      await bookStorage.updateLastOpened("test-id");

      expect(mockBookDb.updateLastOpened).toHaveBeenCalledWith("test-id");
    });
  });

  describe("updateReadingProgress", () => {
    beforeEach(async () => {
      bookStorage = await BookStorage.create();
    });

    it("should update reading progress", async () => {
      await bookStorage.updateReadingProgress("test-id", 0.5, 3);

      expect(mockBookDb.updateReadingProgress).toHaveBeenCalledWith(
        "test-id",
        0.5,
        3,
      );
    });
  });
});
