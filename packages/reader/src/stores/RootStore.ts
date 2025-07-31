import type { SQLiteDB } from "@hayeah/sqlite-browser";
import { createContext, useContext } from "react";
import { getDb } from "../lib/DatabaseProvider";
import { BookLibraryStore } from "./BookLibraryStore";
import { ReaderStore } from "./ReaderStore";

export class RootStore {
  constructor(
    public readerStore: ReaderStore,
    public bookLibraryStore: BookLibraryStore,
  ) {}

  static async create(db?: SQLiteDB): Promise<RootStore> {
    const readerStore = new ReaderStore();
    const sqliteDb = db ?? (await getDb());
    const library = await BookLibraryStore.create(sqliteDb);

    // Wire up dependencies
    readerStore.setBookLibraryStore(library);

    return new RootStore(readerStore, library);
  }

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
