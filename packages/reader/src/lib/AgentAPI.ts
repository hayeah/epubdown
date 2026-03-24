import type { FilesystemLibraryStore } from "./FilesystemLibraryStore";
import type { LibraryStore } from "./LibraryStore";
import type { RootStore } from "../stores/RootStore";
import type { LibraryRegistry } from "../stores/LibraryRegistry";

interface AgentLibraryHandle {
  id: string;
  name: string;
  type: string;
  listBooks(opts?: { match?: string }): Promise<
    { id: string; title: string; author?: string; fileType: string }[]
  >;
  openBook(bookId: string): Promise<void>;
  sync(): Promise<{ bookCount: number }>;
  remove(): Promise<void>;
}

interface EpubdownAgentAPI {
  libraries(): { id: string; name: string; type: string; bookCount: number }[];
  library(id: string): AgentLibraryHandle;
  addFilesystemLibrary(name?: string): Promise<AgentLibraryHandle>;
  addFilesystemLibraryFromHandle(
    name: string,
    handle: FileSystemDirectoryHandle,
  ): Promise<AgentLibraryHandle>;
  navigate(path: string): void;
  route(): string;
}

declare global {
  interface Window {
    __epubdown: EpubdownAgentAPI;
  }
}

export function createAgentAPI(rootStore: RootStore): EpubdownAgentAPI {
  const registry = rootStore.libraryRegistry;

  function makeHandle(libraryId: string): AgentLibraryHandle {
    const lib = registry.libraries.find((l) => l.id === libraryId);
    if (!lib) throw new Error(`Library not found: ${libraryId}`);

    const store = registry.storeFor(libraryId);

    return {
      id: lib.id,
      name: lib.name,
      type: lib.type,

      async listBooks(opts) {
        const books = await store.listBooks(opts);
        return books.map((b) => ({
          id: b.id,
          title: b.title,
          author: b.author,
          fileType: b.fileType,
        }));
      },

      async openBook(bookId: string) {
        const book = (await store.listBooks()).find((b) => b.id === bookId);
        if (!book) throw new Error(`Book not found: ${bookId}`);
        const path =
          book.fileType === "pdf"
            ? `/pdf/${encodeURIComponent(bookId)}`
            : `/book/${encodeURIComponent(bookId)}`;
        window.history.pushState(null, "", path);
        window.dispatchEvent(new PopStateEvent("popstate"));
      },

      async sync() {
        if ("sync" in store && typeof (store as any).sync === "function") {
          const count = await (store as FilesystemLibraryStore).sync();
          return { bookCount: count };
        }
        // For indexeddb, just return current count
        const books = await store.listBooks();
        return { bookCount: books.length };
      },

      async remove() {
        await registry.removeLibrary(libraryId);
      },
    };
  }

  const api: EpubdownAgentAPI = {
    libraries() {
      return registry.libraries.map((lib) => ({
        id: lib.id,
        name: lib.name,
        type: lib.type,
        bookCount: 0, // Would need async to get real count
      }));
    },

    library(id: string) {
      return makeHandle(id);
    },

    async addFilesystemLibrary(name: string) {
      const lib = await registry.addFilesystemLibrary(name);
      return makeHandle(lib.id);
    },

    async addFilesystemLibraryFromHandle(
      name: string,
      handle: FileSystemDirectoryHandle,
    ) {
      const lib = await registry.addFilesystemLibraryFromHandle(name, handle);
      return makeHandle(lib.id);
    },

    navigate(path: string) {
      window.history.pushState(null, "", path);
      window.dispatchEvent(new PopStateEvent("popstate"));
    },

    route() {
      return window.location.pathname;
    },
  };

  return api;
}

export function registerAgentAPI(rootStore: RootStore): void {
  window.__epubdown = createAgentAPI(rootStore);
}
