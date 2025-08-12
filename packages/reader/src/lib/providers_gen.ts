import { CommandPaletteStore } from "../../command/CommandPaletteStore";
import { ReaderStore } from "../stores/ReaderStore";
import { RootStore } from "../stores/RootStore";
import { BookDatabase } from "./BookDatabase";
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
  const eventSystem = provideEventSystem();
  const commandPaletteStore = new CommandPaletteStore(eventSystem);
  const templates = provideReaderTemplates();
  const bookLibraryStore = await provideBookLibraryStore(
    blobStore,
    bookDatabase,
    sQLiteDB,
    eventSystem,
  );
  const readerStore = new ReaderStore(
    bookLibraryStore,
    eventSystem,
    commandPaletteStore,
    templates,
  );
  const rootStore = new RootStore(
    readerStore,
    bookLibraryStore,
    eventSystem,
    commandPaletteStore,
  );
  return rootStore;
}
