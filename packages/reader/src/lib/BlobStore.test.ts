import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BlobStore } from "./BlobStore";

describe("BlobStore", () => {
  let blobStore: BlobStore;
  const testConfig = {
    dbName: "testBlobStorage",
    storeName: "testBlobs",
  };

  beforeEach(async () => {
    blobStore = await BlobStore.create(testConfig);
  });

  afterEach(async () => {
    if (blobStore) {
      await blobStore.clear();
      blobStore.close();
    }
    // Clean up the test database
    await new Promise<void>((resolve, reject) => {
      const deleteReq = indexedDB.deleteDatabase(testConfig.dbName);
      deleteReq.onsuccess = () => resolve();
      deleteReq.onerror = () => reject(deleteReq.error);
    });
  });

  describe("create", () => {
    it("should create a new BlobStore instance with required config", async () => {
      const store = await BlobStore.create({
        dbName: "customDB",
        storeName: "customStore",
      });
      expect(store).toBeInstanceOf(BlobStore);
      store.close();
      await indexedDB.deleteDatabase("customDB");
    });

    it("should handle database creation errors", async () => {
      // Mock indexedDB.open to simulate an error
      const originalOpen = indexedDB.open;
      indexedDB.open = vi.fn().mockImplementation(() => {
        const request = {} as IDBOpenDBRequest;
        setTimeout(() => {
          request.onerror?.({} as Event);
        }, 0);
        return request;
      });

      await expect(
        BlobStore.create({
          dbName: "errorDB",
          storeName: "errorStore",
        }),
      ).rejects.toBeUndefined();

      indexedDB.open = originalOpen;
    });
  });

  describe("put", () => {
    it("should store an ArrayBuffer with a key", async () => {
      const data = new TextEncoder().encode("Hello, World!");
      const buffer = data.buffer;

      await expect(blobStore.put("test-key", buffer)).resolves.toBeUndefined();
    });

    it("should store a Uint8Array with a key", async () => {
      const data = new TextEncoder().encode("Hello, Uint8Array!");

      await expect(blobStore.put("uint8-key", data)).resolves.toBeUndefined();
    });

    it.skip("should store a Blob with a key", async () => {
      // Skipped: fake-indexeddb doesn't properly handle Blob storage
      const blob = new Blob(["Hello, Blob!"], { type: "text/plain" });

      await expect(blobStore.put("blob-key", blob)).resolves.toBeUndefined();
    });

    it("should overwrite existing data with the same key", async () => {
      const data1 = new TextEncoder().encode("First data");
      const data2 = new TextEncoder().encode("Second data");

      await blobStore.put("same-key", data1.buffer);
      await blobStore.put("same-key", data2.buffer);

      const retrieved = await blobStore.getBytes("same-key");
      expect(retrieved).not.toBeNull();
      if (retrieved) {
        const text = new TextDecoder().decode(retrieved);
        expect(text).toBe("Second data");
      }
    });
  });

  describe("getBytes", () => {
    it("should retrieve stored ArrayBuffer as Uint8Array", async () => {
      const originalData = new TextEncoder().encode("Test data");
      await blobStore.put("retrieve-key", originalData.buffer);

      const retrieved = await blobStore.getBytes("retrieve-key");
      expect(retrieved).not.toBeNull();
      expect(retrieved).toBeInstanceOf(Uint8Array);
      if (retrieved) {
        const text = new TextDecoder().decode(retrieved);
        expect(text).toBe("Test data");
      }
    });

    it.skip("should retrieve stored Blob as Uint8Array", async () => {
      // Skipped: fake-indexeddb doesn't properly handle Blob storage
      const blob = new Blob(["Blob data"], { type: "text/plain" });
      await blobStore.put("blob-key", blob);

      const retrieved = await blobStore.getBytes("blob-key");
      expect(retrieved).not.toBeNull();
      expect(retrieved).toBeInstanceOf(Uint8Array);
      if (retrieved) {
        const text = new TextDecoder().decode(retrieved);
        expect(text).toBe("Blob data");
      }
    });

    it("should return null for non-existent keys", async () => {
      const result = await blobStore.getBytes("non-existent-key");
      expect(result).toBeNull();
    });
  });

  describe("getBlob", () => {
    it.skip("should retrieve stored Blob unchanged", async () => {
      // Skipped: fake-indexeddb doesn't properly handle Blob storage
      const blob = new Blob(["Original Blob"], { type: "text/plain" });
      await blobStore.put("blob-key", blob);

      const retrieved = await blobStore.getBlob("blob-key");
      expect(retrieved).not.toBeNull();
      expect(retrieved).toBeInstanceOf(Blob);
      if (retrieved) {
        expect(retrieved.type).toBe("text/plain");
        const text = await retrieved.text();
        expect(text).toBe("Original Blob");
      }
    });

    it("should convert ArrayBuffer to Blob", async () => {
      const data = new TextEncoder().encode("ArrayBuffer data");
      await blobStore.put("buffer-key", data.buffer);

      const retrieved = await blobStore.getBlob("buffer-key");
      expect(retrieved).not.toBeNull();
      expect(retrieved).toBeInstanceOf(Blob);
    });

    it("should return null for non-existent keys", async () => {
      const result = await blobStore.getBlob("non-existent-key");
      expect(result).toBeNull();
    });
  });

  describe("delete", () => {
    it("should delete data by key", async () => {
      const data = new TextEncoder().encode("To be deleted");
      await blobStore.put("delete-key", data.buffer);

      // Verify it exists
      let result = await blobStore.getBytes("delete-key");
      expect(result).not.toBeNull();

      // Delete it
      await expect(blobStore.delete("delete-key")).resolves.toBeUndefined();

      // Verify it's gone
      result = await blobStore.getBytes("delete-key");
      expect(result).toBeNull();
    });

    it("should handle deletion of non-existent keys gracefully", async () => {
      await expect(blobStore.delete("non-existent")).resolves.toBeUndefined();
    });
  });

  describe("clear", () => {
    it("should remove all stored data", async () => {
      // Store multiple items
      const data1 = new TextEncoder().encode("Data 1");
      const data2 = new TextEncoder().encode("Data 2");
      const data3 = new TextEncoder().encode("Data 3");

      await blobStore.put("key1", data1.buffer);
      await blobStore.put("key2", data2.buffer);
      await blobStore.put("key3", data3.buffer);

      // Clear all
      await expect(blobStore.clear()).resolves.toBeUndefined();

      // Verify all are gone
      expect(await blobStore.getBytes("key1")).toBeNull();
      expect(await blobStore.getBytes("key2")).toBeNull();
      expect(await blobStore.getBytes("key3")).toBeNull();
    });
  });

  describe("close", () => {
    it("should close the database connection", () => {
      const mockClose = vi.fn();
      const mockDb = { close: mockClose } as any;
      const store = new BlobStore(mockDb, testConfig);

      store.close();

      expect(mockClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("multiple instances", () => {
    it("should allow multiple independent stores", async () => {
      const store1 = await BlobStore.create({
        dbName: "db1",
        storeName: "store1",
      });

      const store2 = await BlobStore.create({
        dbName: "db2",
        storeName: "store2",
      });

      const data1 = new TextEncoder().encode("Store 1 data");
      const data2 = new TextEncoder().encode("Store 2 data");

      await store1.put("key", data1.buffer);
      await store2.put("key", data2.buffer);

      const retrieved1 = await store1.getBytes("key");
      const retrieved2 = await store2.getBytes("key");

      expect(retrieved1).not.toBeNull();
      expect(retrieved2).not.toBeNull();

      if (retrieved1 && retrieved2) {
        expect(new TextDecoder().decode(retrieved1)).toBe("Store 1 data");
        expect(new TextDecoder().decode(retrieved2)).toBe("Store 2 data");
      }

      store1.close();
      store2.close();
      await indexedDB.deleteDatabase("db1");
      await indexedDB.deleteDatabase("db2");
    });
  });
});
