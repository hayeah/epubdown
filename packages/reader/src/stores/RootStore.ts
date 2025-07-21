import { createContext, useContext } from "react";
import { getDb } from "../lib/DatabaseProvider";
import { BookLibraryStore } from "./BookLibraryStore";
import { ReaderStore } from "./ReaderStore";

export class RootStore {
  readerStore: ReaderStore;
  bookLibraryStore: BookLibraryStore | null = null;

  constructor() {
    this.readerStore = new ReaderStore();
  }

  async initializeBookLibrary(): Promise<void> {
    if (!this.bookLibraryStore) {
      const db = await getDb();
      this.bookLibraryStore = await BookLibraryStore.create(db);
    }
  }

  reset() {
    this.readerStore.reset();
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
  if (!rootStore.bookLibraryStore) {
    throw new Error(
      "BookLibraryStore not initialized. Call initializeBookLibrary() first.",
    );
  }
  return rootStore.bookLibraryStore;
}
