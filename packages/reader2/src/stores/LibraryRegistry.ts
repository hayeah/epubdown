import type { SQLiteDB } from "@hayeah/sqlite-browser";
import { action, makeObservable, observable, runInAction } from "mobx";
import { CapacitorFilesystemLibraryStore } from "../lib/CapacitorFilesystemLibraryStore";
import { DirectoryHandleStore } from "../lib/DirectoryHandleStore";
import { FilesystemLibraryStore } from "../lib/FilesystemLibraryStore";
import type {
  BookMetadata,
  LibraryConfig,
  LibraryStore,
} from "../lib/LibraryStore";
import { isNative } from "../lib/platform";

export class LibraryRegistry {
  libraries: LibraryConfig[] = [];
  activeLibraryId = "default";
  private handleStore: DirectoryHandleStore | null = null;
  private handles = new Map<string, FileSystemDirectoryHandle>();
  private storeCache = new Map<string, LibraryStore>();

  constructor(private readonly db: SQLiteDB) {
    makeObservable(this, {
      libraries: observable,
      activeLibraryId: observable,
      switchLibrary: action,
    });
  }

  async load(): Promise<void> {
    // On native, we don't use DirectoryHandleStore (IndexedDB handles)
    if (!isNative()) {
      this.handleStore = await DirectoryHandleStore.open();
      this.handles = await this.handleStore.all();
    }

    const result = await this.db.query<LibraryConfig>(
      "SELECT * FROM libraries ORDER BY created_at ASC",
    );
    runInAction(() => {
      this.libraries = result.rows.map((r: any) => ({
        ...r,
        createdAt: r.created_at ?? r.createdAt,
        dirPath: r.dir_path ?? r.dirPath ?? null,
      }));
    });
  }

  get activeLibrary(): LibraryConfig | undefined {
    return this.libraries.find((l) => l.id === this.activeLibraryId);
  }

  switchLibrary(id: string): void {
    this.activeLibraryId = id;
  }

  storeFor(libraryId: string): LibraryStore | null {
    const cached = this.storeCache.get(libraryId);
    if (cached) return cached;

    const lib = this.libraries.find((l) => l.id === libraryId);
    if (!lib) return null;

    if (lib.type === "filesystem") {
      let store: LibraryStore | null = null;

      if (isNative() && lib.dirPath) {
        // Native: use Capacitor filesystem with the stored directory path
        store = new CapacitorFilesystemLibraryStore(
          this.db,
          libraryId,
          lib.dirPath,
        );
      } else {
        // Web: use File System Access API handle
        const handle = this.handles.get(libraryId);
        if (!handle) return null;
        store = new FilesystemLibraryStore(this.db, libraryId, handle);
      }

      this.storeCache.set(libraryId, store);
      return store;
    }

    // IndexedDB library — not implemented yet in reader2, return null
    return null;
  }

  get activeStore(): LibraryStore | null {
    return this.storeFor(this.activeLibraryId);
  }

  /**
   * Add a filesystem library using a web FileSystemDirectoryHandle.
   */
  async addFilesystemLibrary(
    name: string,
    handle: FileSystemDirectoryHandle,
  ): Promise<LibraryConfig> {
    const id = crypto.randomUUID();
    const lib: LibraryConfig = {
      id,
      name,
      type: "filesystem",
      createdAt: Date.now(),
    };

    await this.db.exec(
      "INSERT INTO libraries (id, name, type, created_at) VALUES (?, ?, ?, ?)",
      [lib.id, lib.name, lib.type, lib.createdAt],
    );
    await this.handleStore!.put(id, handle);
    this.handles.set(id, handle);

    runInAction(() => {
      this.libraries.push(lib);
    });
    return lib;
  }

  /**
   * Add a filesystem library using a native directory path (Capacitor).
   */
  async addNativeFilesystemLibrary(
    name: string,
    dirPath: string,
  ): Promise<LibraryConfig> {
    const id = crypto.randomUUID();
    const lib: LibraryConfig = {
      id,
      name,
      type: "filesystem",
      createdAt: Date.now(),
      dirPath,
    };

    await this.db.exec(
      "INSERT INTO libraries (id, name, type, created_at, dir_path) VALUES (?, ?, ?, ?, ?)",
      [lib.id, lib.name, lib.type, lib.createdAt, dirPath],
    );

    runInAction(() => {
      this.libraries.push(lib);
    });
    return lib;
  }

  async removeLibrary(id: string): Promise<void> {
    if (id === "default") return;
    await this.db.exec("DELETE FROM books WHERE library_id = ?", [id]);
    await this.db.exec("DELETE FROM libraries WHERE id = ?", [id]);
    await this.handleStore?.delete(id);
    this.handles.delete(id);
    this.storeCache.delete(id);

    runInAction(() => {
      this.libraries = this.libraries.filter((l) => l.id !== id);
      if (this.activeLibraryId === id) {
        this.activeLibraryId = "default";
      }
    });
  }

  async loadBookById(
    bookId: number,
  ): Promise<{ blob: Blob; metadata: BookMetadata } | null> {
    const result = await this.db.query(
      "SELECT library_id FROM books WHERE id = ?",
      [bookId],
    );
    if (result.rows.length === 0) return null;
    const libraryId = (result.rows[0] as any).library_id;
    const store = this.storeFor(libraryId);
    if (!store) return null;
    return store.loadBook(String(bookId));
  }
}
