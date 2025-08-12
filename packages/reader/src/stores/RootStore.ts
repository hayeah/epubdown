import type { SQLiteDB } from "@hayeah/sqlite-browser";
import { createContext, useContext } from "react";
import type { CommandPaletteStore } from "../../command/CommandPaletteStore";
import type { AppEventSystem } from "../app/context";
import { getDb } from "../lib/providers";
import type { BookLibraryStore } from "./BookLibraryStore";
import type { ReaderStore } from "./ReaderStore";

export class RootStore {
  constructor(
    public readerStore: ReaderStore,
    public bookLibraryStore: BookLibraryStore,
    public eventSystem: AppEventSystem,
    public commandPaletteStore: CommandPaletteStore,
  ) {}

  reset() {
    this.readerStore.reset();
  }

  async close(): Promise<void> {
    if (this.bookLibraryStore) {
      await this.bookLibraryStore.close();
    }
  }
}

const RootStoreContext = createContext<RootStore | null>(null);

export const StoreProvider = RootStoreContext.Provider;

export function useRootStore(): RootStore {
  const store = useContext(RootStoreContext);
  if (!store) {
    throw new Error("useRootStore must be used within StoreProvider");
  }
  return store;
}

export function useReaderStore(): ReaderStore {
  const rootStore = useRootStore();
  return rootStore.readerStore;
}

export function useBookLibraryStore(): BookLibraryStore {
  const rootStore = useRootStore();
  return rootStore.bookLibraryStore;
}

export function useCommandPaletteStore(): CommandPaletteStore {
  const rootStore = useRootStore();
  return rootStore.commandPaletteStore;
}
