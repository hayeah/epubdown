import type { SQLiteDB } from "@hayeah/sqlite-browser";
import { createContext, useContext } from "react";
import { getDB } from "../lib/db";
import { LibraryRegistry } from "./LibraryRegistry";
import { ReaderStore } from "./ReaderStore";

export class RootStore {
  libraryRegistry: LibraryRegistry;
  readerStore: ReaderStore;

  constructor(db: SQLiteDB) {
    this.libraryRegistry = new LibraryRegistry(db);
    this.readerStore = new ReaderStore(this.libraryRegistry);
  }

  async init(): Promise<void> {
    await this.libraryRegistry.load();
  }
}

let rootStore: RootStore | null = null;

export async function initRootStore(): Promise<RootStore> {
  if (rootStore) return rootStore;
  const db = await getDB();
  rootStore = new RootStore(db);
  await rootStore.init();
  return rootStore;
}

export const RootStoreContext = createContext<RootStore | null>(null);

export function useRootStore(): RootStore {
  const store = useContext(RootStoreContext);
  if (!store) throw new Error("RootStore not provided");
  return store;
}

export function useReaderStore(): ReaderStore {
  return useRootStore().readerStore;
}

export function useLibraryRegistry(): LibraryRegistry {
  return useRootStore().libraryRegistry;
}
