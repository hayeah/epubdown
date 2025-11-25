import type { SQLiteDB } from "@hayeah/sqlite-browser";
import { debounce } from "lodash";
import type { DebouncedFunc } from "lodash";
import { makeAutoObservable, runInAction } from "mobx";
import { BlobStore } from "../lib/BlobStore";
import {
  CollectionDatabase,
  type CollectionMetadata,
} from "../lib/CollectionDatabase";
import { CollectionManager } from "../lib/CollectionManager";

export class CollectionStore {
  collections: CollectionMetadata[] = [];
  isLoading = false;
  searchQuery = "";
  loadCollectionsDebounced: DebouncedFunc<() => void>;

  private readonly manager: CollectionManager;

  constructor(
    private readonly blobStore: BlobStore,
    private readonly collectionDb: CollectionDatabase,
  ) {
    this.manager = new CollectionManager(collectionDb, blobStore);
    makeAutoObservable(this, {
      loadCollectionsDebounced: false,
    });

    this.loadCollectionsDebounced = debounce(() => {
      this.loadCollections();
    }, 100);
  }

  static async create(db: SQLiteDB): Promise<CollectionStore> {
    const collectionDb = await CollectionDatabase.create(db);
    const blobStore = await BlobStore.create({
      dbName: "epubdown-collections",
      storeName: "collections",
    });

    // Run migration to fix .mdx file types
    await collectionDb.migrateMdxFileTypes();

    const store = new CollectionStore(blobStore, collectionDb);
    await store.loadCollections();
    return store;
  }

  async loadCollections(): Promise<void> {
    this.isLoading = true;

    try {
      const collections = await this.collectionDb.getAllCollections();
      runInAction(() => {
        this.collections = collections;
        this.isLoading = false;
      });
    } catch (error) {
      runInAction(() => {
        this.isLoading = false;
      });
      throw error;
    }
  }

  async searchCollections(query: string): Promise<void> {
    this.searchQuery = query;
    this.isLoading = true;

    try {
      const collections = await this.collectionDb.searchCollections(query);
      runInAction(() => {
        this.collections = collections;
        this.isLoading = false;
      });
    } catch (error) {
      runInAction(() => {
        this.isLoading = false;
      });
      throw error;
    }
  }

  async createCollection(
    name: string,
    files: File[],
  ): Promise<CollectionMetadata> {
    const collection = await this.manager.createCollection(name, files);
    this.loadCollectionsDebounced();
    return collection;
  }

  async addFilesToCollection(
    collectionId: number,
    files: File[],
  ): Promise<{ added: number; skipped: number }> {
    const result = await this.manager.addFilesToCollection(collectionId, files);
    this.loadCollectionsDebounced();
    return result;
  }

  async removeFileFromCollection(
    collectionId: number,
    filePath: string,
  ): Promise<void> {
    await this.manager.removeFileFromCollection(collectionId, filePath);
    this.loadCollectionsDebounced();
  }

  async deleteCollection(collectionId: number): Promise<void> {
    await this.manager.deleteCollection(collectionId);
    await this.loadCollections();
  }

  async getCollection(
    collectionId: number,
  ): Promise<CollectionMetadata | null> {
    return this.collectionDb.getCollection(collectionId);
  }

  async updateLastOpened(collectionId: number): Promise<void> {
    await this.collectionDb.updateLastOpened(collectionId);
    runInAction(() => {
      const collection = this.collections.find((c) => c.id === collectionId);
      if (collection) {
        collection.lastOpenedAt = Date.now();
      }
    });
  }

  async exportCollection(collectionId: number): Promise<Blob> {
    return this.manager.exportCollection(collectionId);
  }

  getManager(): CollectionManager {
    return this.manager;
  }

  async close(): Promise<void> {
    this.loadCollectionsDebounced.cancel();
    this.blobStore.close();
  }
}
