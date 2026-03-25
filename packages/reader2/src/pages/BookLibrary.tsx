import { BookOpen, FolderOpen, Library, Search } from "lucide-react";
import { observer } from "mobx-react-lite";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { BookMetadata } from "../lib/LibraryStore";
import { useLibraryRegistry } from "../stores/RootStore";
import { useLocation } from "wouter";

const __DOC__ = `
# BookLibrary

Page for browsing and managing epub library collections.

## window.__agent

- registry — LibraryRegistry (MobX observable)
  - registry.libraries — array of LibraryConfig
  - registry.activeLibraryId (string) — selected library ID
- books — current book list (array)
- searchQuery — current search filter (string)
- pickDirectory() — trigger directory picker to add a filesystem library
- $searchInput — the search <input> element
- $bookList — the scrollable book list container
`;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const BookLibrary: React.FC = observer(() => {
  const registry = useLibraryRegistry();
  const [, navigate] = useLocation();
  const [books, setBooks] = useState<BookMetadata[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const searchRef = useRef<HTMLInputElement>(null);
  const bookListRef = useRef<HTMLDivElement>(null);

  const loadBooks = useCallback(async () => {
    const store = registry.activeStore;
    if (!store) {
      setBooks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await store.listBooks({ match: searchQuery || undefined });
      setBooks(result);
    } catch (err) {
      console.error("Failed to load books:", err);
    } finally {
      setLoading(false);
    }
  }, [registry.activeStore, searchQuery]);

  useEffect(() => {
    loadBooks();
  }, [loadBooks]);

  const pickDirectory = async () => {
    try {
      const handle = await window.showDirectoryPicker({ mode: "read" });
      const lib = await registry.addFilesystemLibrary(handle.name, handle);
      registry.switchLibrary(lib.id);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      console.error(e);
    }
  };

  const openBook = (book: BookMetadata) => {
    if (book.fileType === "pdf") {
      navigate(`/pdf/${book.id}`);
    } else {
      navigate(`/book/${book.id}`);
    }
  };

  // Register __agent
  useEffect(() => {
    (window as any).__agent = {
      registry,
      get books() {
        return books;
      },
      get searchQuery() {
        return searchQuery;
      },
      pickDirectory,
      get $searchInput() {
        return searchRef.current;
      },
      get $bookList() {
        return bookListRef.current;
      },
    };
    return () => {
      (window as any).__agent = null;
    };
  });

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-4xl px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="flex items-center gap-2 text-xl font-semibold text-stone-800">
              <Library className="w-5 h-5 text-orange-600" />
              reader2
            </h1>
            <button
              type="button"
              onClick={pickDirectory}
              className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 transition-colors"
            >
              <FolderOpen className="w-4 h-4" />
              Add Library
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-6">
        {/* Library tabs */}
        {registry.libraries.length > 1 && (
          <div className="flex gap-2 mb-6 overflow-x-auto">
            {registry.libraries.map((lib) => (
              <button
                key={lib.id}
                type="button"
                onClick={() => registry.switchLibrary(lib.id)}
                className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
                  registry.activeLibraryId === lib.id
                    ? "bg-orange-600 text-white"
                    : "bg-stone-200 text-stone-600 hover:bg-stone-300"
                }`}
              >
                {lib.type === "filesystem" ? (
                  <FolderOpen className="w-3.5 h-3.5" />
                ) : (
                  <Library className="w-3.5 h-3.5" />
                )}
                {lib.name}
              </button>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            ref={searchRef}
            type="text"
            placeholder="Search books..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-stone-300 bg-white py-2.5 pl-10 pr-4 text-sm text-stone-800 placeholder:text-stone-400 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>

        {/* Book list */}
        <div ref={bookListRef}>
          {loading && <p className="text-stone-500 text-sm py-8 text-center">Loading...</p>}

          {!loading && books.length === 0 && (
            <div className="text-center py-16 text-stone-400">
              <BookOpen className="w-12 h-12 mx-auto mb-3" />
              <p className="text-sm">
                {registry.activeStore ? "No books found" : "Add a library folder to get started"}
              </p>
            </div>
          )}

          {!loading && books.length > 0 && (
            <>
              <p className="text-xs text-stone-400 mb-3">
                {books.length} book{books.length !== 1 ? "s" : ""}
              </p>
              <div className="space-y-1">
                {books.map((book) => (
                  <button
                    key={book.id}
                    type="button"
                    onClick={() => openBook(book)}
                    className="w-full flex items-baseline justify-between rounded-lg px-4 py-3 text-left hover:bg-white hover:shadow-sm transition-all group"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-stone-800 group-hover:text-orange-700 truncate">
                        {book.title}
                      </div>
                      {book.author && (
                        <div className="text-xs text-stone-400 mt-0.5 truncate">{book.author}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-3 ml-4 shrink-0">
                      <span className="text-xs text-stone-300 uppercase">{book.fileType}</span>
                      <span className="text-xs text-stone-300">{formatSize(book.fileSize)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
});
