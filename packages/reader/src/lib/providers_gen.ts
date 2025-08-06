import { ReaderStore } from "../stores/ReaderStore";
import { RootStore } from "../stores/RootStore";
import { BookDatabase } from "./BookDatabase";
import {
  provideBlobStore,
  provideBookLibraryStore,
  provideSQLiteDB,
} from "./providers";
import type { StorageConfig } from "./providers";

export async function initRootStore(cfg: StorageConfig) {
  const blobStore = await provideBlobStore(cfg);
  const sQLiteDB = await provideSQLiteDB(cfg);
  const bookDatabase = new BookDatabase(sQLiteDB);
  const bookLibraryStore = await provideBookLibraryStore(
    blobStore,
    bookDatabase,
    sQLiteDB,
  );
  const readerStore = new ReaderStore(bookLibraryStore);
  const rootStore = new RootStore(readerStore, bookLibraryStore);
  return rootStore;
}
