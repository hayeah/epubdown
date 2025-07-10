export interface BlobStoreConfig {
  dbName: string;
  storeName: string;
}

type BufferSource = ArrayBuffer | ArrayBufferView;

export class BlobStore {
  private static readonly CURRENT_DB_VERSION = 1;

  private readonly dbName: string;
  private readonly storeName: string;

  constructor(
    private readonly db: IDBDatabase,
    config: BlobStoreConfig,
  ) {
    this.dbName = config.dbName;
    this.storeName = config.storeName;
  }

  static async create(config: BlobStoreConfig): Promise<BlobStore> {
    const dbName = config.dbName;
    const storeName = config.storeName;
    const version = BlobStore.CURRENT_DB_VERSION;

    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(dbName, version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName);
        }
      };
    });

    return new BlobStore(db, config);
  }

  private async tx<T>(
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const transaction = this.db.transaction([this.storeName], mode);
    const store = transaction.objectStore(this.storeName);
    return new Promise((resolve, reject) => {
      const request = operation(store);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async put(key: string, data: Blob | BufferSource): Promise<void> {
    await this.tx("readwrite", (store) => store.put(data, key));
  }

  async getBytes(key: string): Promise<Uint8Array | null> {
    const result = await this.tx("readonly", (store) => store.get(key));
    if (result === undefined) return null;

    // Handle Blob
    if (result instanceof Blob) {
      return new Uint8Array(await result.arrayBuffer());
    }

    // Handle ArrayBuffer
    if (result instanceof ArrayBuffer) {
      return new Uint8Array(result);
    }

    // Handle typed array views
    if (ArrayBuffer.isView(result)) {
      return new Uint8Array(
        result.buffer,
        result.byteOffset,
        result.byteLength,
      );
    }

    // Fallback for other types
    return new Uint8Array(result);
  }

  async getBlob(key: string): Promise<Blob | null> {
    const result = await this.tx("readonly", (store) => store.get(key));
    if (result === undefined) return null;

    // Return Blob unchanged
    if (result instanceof Blob) {
      return result;
    }

    // Convert ArrayBuffer or typed array to Blob
    return new Blob([result]);
  }

  async delete(key: string): Promise<void> {
    await this.tx("readwrite", (store) => store.delete(key));
  }

  async clear(): Promise<void> {
    await this.tx("readwrite", (store) => store.clear());
  }

  close(): void {
    this.db.close();
  }
}
