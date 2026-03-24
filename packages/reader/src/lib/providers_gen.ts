import { CommandPaletteStore } from "../../command/CommandPaletteStore";
import { ReaderStore } from "../stores/ReaderStore";
import { RootStore } from "../stores/RootStore";
import { LibraryRegistry } from "../stores/LibraryRegistry";
import { BookDatabase } from "./BookDatabase";
import { DirectoryHandleStore } from "./DirectoryHandleStore";
import {
  provideBlobStore,
  provideBookLibraryStore,
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

  // Initialize library registry
  const handleStore = await DirectoryHandleStore.open();
  const libraryRegistry = new LibraryRegistry(sQLiteDB, blobStore, handleStore);
  await libraryRegistry.load();

  const commandPaletteStore = new CommandPaletteStore(appEventSystem);
  const readerTemplates = provideReaderTemplates();
  const readerStore = new ReaderStore(
    bookLibraryStore,
    appEventSystem,
    commandPaletteStore,
    readerTemplates,
    libraryRegistry,
  );
  const rootStore = new RootStore(
    readerStore,
    bookLibraryStore,
    libraryRegistry,
    appEventSystem,
    commandPaletteStore,
  );
  return rootStore;
}
