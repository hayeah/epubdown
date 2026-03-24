import type { SQLiteDB } from "@hayeah/sqlite-browser";
import { makeAutoObservable, runInAction } from "mobx";

// File System Access API augmentation (not in default TS lib)
declare global {
  interface Window {
    showDirectoryPicker(options?: {
      mode?: "read" | "readwrite";
    }): Promise<FileSystemDirectoryHandle>;
  }
  interface FileSystemDirectoryHandle {
    queryPermission(descriptor?: {
      mode?: "read" | "readwrite";
    }): Promise<PermissionState>;
    requestPermission(descriptor?: {
      mode?: "read" | "readwrite";
    }): Promise<PermissionState>;
  }
}
import type { DirectoryHandleStore } from "../lib/DirectoryHandleStore";
import { FilesystemLibraryStore } from "../lib/FilesystemLibraryStore";
import { IndexedDBLibraryStore } from "../lib/IndexedDBLibraryStore";
import type { LibraryConfig, LibraryStore } from "../lib/LibraryStore";
import type { BlobStore } from "../lib/BlobStore";

export class LibraryRegistry {
  libraries: LibraryConfig[] = [];
  activeLibraryId = "default";
  private storeCache = new Map<string, LibraryStore>();
  private handleCache = new Map<string, FileSystemDirectoryHandle>();

  constructor(
    private readonly db: SQLiteDB,
    private readonly blobStore: BlobStore,
    private readonly handleStore: DirectoryHandleStore,
  ) {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  async load(): Promise<void> {
    const result = await this.db.query(
      "SELECT * FROM libraries ORDER BY created_at ASC",
    );
    const handles = await this.handleStore.all();

    runInAction(() => {
      this.libraries = result.rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        type: row.type,
        createdAt: row.created_at,
      }));
      this.handleCache = handles;

      // Set active library to the first one if "default" doesn't exist
      if (
        !this.libraries.find((l) => l.id === this.activeLibraryId) &&
        this.libraries.length > 0
      ) {
        this.activeLibraryId = this.libraries[0]!.id;
      }
    });
  }

  get activeLibrary(): LibraryConfig | undefined {
    return this.libraries.find((l) => l.id === this.activeLibraryId);
  }

  activeStore(): LibraryStore {
    return this.storeFor(this.activeLibraryId);
  }

  storeFor(libraryId: string): LibraryStore {
    const cached = this.storeCache.get(libraryId);
    if (cached) return cached;

    const lib = this.libraries.find((l) => l.id === libraryId);
    if (!lib) throw new Error(`Library not found: ${libraryId}`);

    let store: LibraryStore;
    if (lib.type === "filesystem") {
      const handle = this.handleCache.get(libraryId);
      if (!handle)
        throw new Error(`Directory handle not found for library: ${libraryId}`);
      store = new FilesystemLibraryStore(this.db, libraryId, handle);
    } else {
      store = new IndexedDBLibraryStore(this.db, this.blobStore, libraryId);
    }

    this.storeCache.set(libraryId, store);
    return store;
  }

  switchLibrary(libraryId: string): void {
    if (!this.libraries.find((l) => l.id === libraryId)) {
      throw new Error(`Library not found: ${libraryId}`);
    }
    this.activeLibraryId = libraryId;
  }

  async addFilesystemLibrary(name: string): Promise<LibraryConfig> {
    const dirHandle = await window.showDirectoryPicker({ mode: "read" } as any);
    const id = crypto.randomUUID();
    const createdAt = Date.now();

    await this.db.exec(
      "INSERT INTO libraries (id, name, type, created_at) VALUES (?, ?, ?, ?)",
      [id, name, "filesystem", createdAt],
    );
    await this.handleStore.put(id, dirHandle);

    const lib: LibraryConfig = { id, name, type: "filesystem", createdAt };

    runInAction(() => {
      this.libraries.push(lib);
      this.handleCache.set(id, dirHandle);
    });

    return lib;
  }

  async addFilesystemLibraryFromHandle(
    name: string,
    dirHandle: FileSystemDirectoryHandle,
  ): Promise<LibraryConfig> {
    const id = crypto.randomUUID();
    const createdAt = Date.now();

    await this.db.exec(
      "INSERT INTO libraries (id, name, type, created_at) VALUES (?, ?, ?, ?)",
      [id, name, "filesystem", createdAt],
    );
    await this.handleStore.put(id, dirHandle);

    const lib: LibraryConfig = { id, name, type: "filesystem", createdAt };

    runInAction(() => {
      this.libraries.push(lib);
      this.handleCache.set(id, dirHandle);
    });

    return lib;
  }

  async removeLibrary(id: string): Promise<void> {
    if (id === "default") throw new Error("Cannot remove the default library");

    await this.db.exec("DELETE FROM books WHERE library_id = ?", [id]);
    await this.db.exec("DELETE FROM libraries WHERE id = ?", [id]);
    await this.handleStore.delete(id);

    this.storeCache.delete(id);

    runInAction(() => {
      this.libraries = this.libraries.filter((l) => l.id !== id);
      this.handleCache.delete(id);
      if (this.activeLibraryId === id) {
        this.activeLibraryId = "default";
      }
    });
  }

  async checkPermission(libraryId: string): Promise<PermissionState> {
    const handle = this.handleCache.get(libraryId);
    if (!handle) return "denied";
    return handle.queryPermission({ mode: "read" });
  }

  async requestPermission(libraryId: string): Promise<PermissionState> {
    const handle = this.handleCache.get(libraryId);
    if (!handle) return "denied";
    return handle.requestPermission({ mode: "read" });
  }
}
