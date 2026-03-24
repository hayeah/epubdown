const DB_NAME = "epubdown-dir-handles";
const DB_VERSION = 1;
const STORE_NAME = "handles";

/**
 * IndexedDB store for persisting FileSystemDirectoryHandle references.
 * These cannot be stored in SQLite — only IndexedDB supports structured cloning.
 */
export class DirectoryHandleStore {
  private constructor(private readonly db: IDBDatabase) {}

  static async open(): Promise<DirectoryHandleStore> {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE_NAME)) {
          req.result.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return new DirectoryHandleStore(db);
  }

  async get(libraryId: string): Promise<FileSystemDirectoryHandle | null> {
    return this.tx("readonly", (store) => store.get(libraryId));
  }

  async put(
    libraryId: string,
    handle: FileSystemDirectoryHandle,
  ): Promise<void> {
    await this.tx("readwrite", (store) => store.put(handle, libraryId));
  }

  async delete(libraryId: string): Promise<void> {
    await this.tx("readwrite", (store) => store.delete(libraryId));
  }

  async all(): Promise<Map<string, FileSystemDirectoryHandle>> {
    const keys = await this.tx("readonly", (store) => store.getAllKeys());
    const values = await this.tx("readonly", (store) => store.getAll());
    const map = new Map<string, FileSystemDirectoryHandle>();
    for (let i = 0; i < keys.length; i++) {
      map.set(String(keys[i]), values[i]);
    }
    return map;
  }

  close(): void {
    this.db.close();
  }

  private tx<T>(
    mode: IDBTransactionMode,
    op: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_NAME, mode);
      const req = op(tx.objectStore(STORE_NAME));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
}
