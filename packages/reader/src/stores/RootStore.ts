import { createContext, useContext } from "react";
import { BookLibraryStore } from "./BookLibraryStore";
import { ChapterStore } from "./ChapterStore";
import { EPubStore } from "./EPubStore";
import { ResourceStore } from "./ResourceStore";

export class RootStore {
  epubStore: EPubStore;
  chapterStore: ChapterStore;
  resourceStore: ResourceStore;
  bookLibraryStore: BookLibraryStore;

  constructor() {
    this.epubStore = new EPubStore();
    this.chapterStore = new ChapterStore();
    this.resourceStore = new ResourceStore();
    this.bookLibraryStore = new BookLibraryStore();
  }

  reset() {
    this.epubStore.reset();
    this.chapterStore.clearCache();
    this.resourceStore.clearCache();
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

export function useEpubStore(): EPubStore {
  const rootStore = useRootStore();
  return rootStore.epubStore;
}

export function useChapterStore(): ChapterStore {
  const rootStore = useRootStore();
  return rootStore.chapterStore;
}

export function useResourceStore(): ResourceStore {
  const rootStore = useRootStore();
  return rootStore.resourceStore;
}

export function useBookLibraryStore(): BookLibraryStore {
  const rootStore = useRootStore();
  return rootStore.bookLibraryStore;
}
