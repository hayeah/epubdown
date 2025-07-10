export interface BlobStoreConfig {
  dbName: string;
  storeName: string;
  version?: number;
}

export class BlobStore {
  private static readonly DEFAULT_DB_VERSION = 1;

  private readonly dbName: string;
  private readonly storeName: string;
  private readonly version: number;

  constructor(
    private readonly db: IDBDatabase,
    config: BlobStoreConfig,
  ) {
    this.dbName = config.dbName;
    this.storeName = config.storeName;
    this.version = config.version || BlobStore.DEFAULT_DB_VERSION;
  }

  static async create(config: BlobStoreConfig): Promise<BlobStore> {
    const dbName = config.dbName;
    const storeName = config.storeName;
    const version = config.version || BlobStore.DEFAULT_DB_VERSION;

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

  close(): void {
    this.db.close();
  }
}
