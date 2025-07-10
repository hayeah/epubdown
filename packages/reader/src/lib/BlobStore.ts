export class BlobStore {
  private static readonly DB_NAME = "blobStorage";
  private static readonly STORE_NAME = "blobs";
  private static readonly DB_VERSION = 1;
  private static instance: BlobStore | null = null;

  private constructor(private readonly db: IDBDatabase) {}

  static async singleton(): Promise<BlobStore> {
    if (this.instance) {
      return this.instance;
    }

    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          db.createObjectStore(this.STORE_NAME);
        }
      };
    });

    this.instance = new BlobStore(db);
    return this.instance;
  }

  private async tx<T>(
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest<T>
  ): Promise<T> {
    const transaction = this.db.transaction([BlobStore.STORE_NAME], mode);
    const store = transaction.objectStore(BlobStore.STORE_NAME);
    return new Promise((resolve, reject) => {
      const request = operation(store);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async put(key: string, data: ArrayBuffer): Promise<void> {
    await this.tx("readwrite", (store) => store.put(data, key));
  }

  async get(key: string): Promise<ArrayBuffer | null> {
    const result = await this.tx("readonly", (store) => store.get(key));
    return result === undefined ? null : result;
  }

  async delete(key: string): Promise<void> {
    await this.tx("readwrite", (store) => store.delete(key));
  }

  async clear(): Promise<void> {
    await this.tx("readwrite", (store) => store.clear());
  }
}
