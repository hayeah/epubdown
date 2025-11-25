import { CommandPaletteStore } from "../../command/CommandPaletteStore";
import { ReaderStore } from "../stores/ReaderStore";
import { RootStore } from "../stores/RootStore";
import { BookDatabase } from "./BookDatabase";
import {
  provideBlobStore,
  provideBookLibraryStore,
  provideCollectionStore,
  provideEventSystem,
  provideReaderTemplates,
  provideSQLiteDB,
} from "./providers";
import type { StorageConfig } from "./providers";

export async function initRootStore(cfg: StorageConfig) {
  const blobStore = await provideBlobStore(cfg);
  const sQLiteDB = await provideSQLiteDB(cfg);
  const bookDatabase = new BookDatabase(sQLiteDB);
  const appEventSystem = provideEventSystem();
  const bookLibraryStore = await provideBookLibraryStore(
    blobStore,
    bookDatabase,
    sQLiteDB,
    appEventSystem,
  );
  const collectionStore = await provideCollectionStore(sQLiteDB);
  const commandPaletteStore = new CommandPaletteStore(appEventSystem);
  const readerTemplates = provideReaderTemplates();
  const readerStore = new ReaderStore(
    bookLibraryStore,
    appEventSystem,
    commandPaletteStore,
    readerTemplates,
  );
  const rootStore = new RootStore(
    readerStore,
    bookLibraryStore,
    collectionStore,
    appEventSystem,
    commandPaletteStore,
    readerTemplates,
  );
  return rootStore;
}
