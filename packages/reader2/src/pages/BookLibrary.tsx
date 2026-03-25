import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import {
  Search,
  Plus,
  Library,
  BookOpen,
  MoreVertical,
  FolderPlus,
  ChevronRight,
  Hash,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { observer } from "mobx-react-lite";
import { cn } from "../lib/utils";
import { ASCIIMatrixStream } from "../components/ASCIIMatrixStream/ASCIIMatrixStream";
import { SidebarShimmer } from "../components/SidebarShimmer";
import { useIsMobile } from "../hooks/use-mobile";
import type { BookMetadata, LibraryConfig } from "../lib/LibraryStore";
import { useLibraryRegistry } from "../stores/RootStore";
import type { ElementType } from "react";

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
- $scrollContainer — the scrollable book list container
`;

const LIBRARY_ICONS: Record<string, ElementType> = {
  default: BookOpen,
};

function iconFor(lib: LibraryConfig): ElementType {
  return LIBRARY_ICONS[lib.id] ?? Hash;
}

export const BookLibrary = observer(() => {
  const isMobile = useIsMobile();
  const registry = useLibraryRegistry();
  const [, navigate] = useLocation();
  const searchRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [books, setBooks] = useState<BookMetadata[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);

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
      get $scrollContainer() {
        return scrollRef.current;
      },
    };
    return () => {
      (window as any).__agent = null;
    };
  });

  const openBook = (book: BookMetadata) => {
    if (book.fileType === "pdf") {
      navigate(`/pdf/${book.id}`);
    } else {
      navigate(`/book/${book.id}`);
    }
  };

  const collectionsNav = (
    <nav className="px-3 space-y-1">
      <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-3 mb-2 mt-4">
        Collections
      </div>
      {registry.libraries.map((lib) => {
        const Icon = iconFor(lib);
        return (
          <button
            key={lib.id}
            onClick={() => {
              if (isMobile) {
                registry.switchLibrary(lib.id);
                setSheetOpen(false);
              } else {
                registry.switchLibrary(lib.id);
              }
            }}
            className={cn(
              "w-full flex items-center justify-between px-3 py-2 rounded-md transition-all group",
              registry.activeLibraryId === lib.id
                ? "bg-orange-50 text-orange-700 font-medium"
                : "text-gray-500 hover:bg-gray-50 hover:text-gray-900",
            )}
          >
            <div className="flex items-center gap-3">
              <Icon size={16} strokeWidth={registry.activeLibraryId === lib.id ? 2.5 : 2} />
              <span className="text-sm">{lib.name}</span>
            </div>
          </button>
        );
      })}

      <button
        onClick={pickDirectory}
        className="w-full flex items-center gap-3 px-3 py-2 mt-4 text-gray-400 hover:text-gray-900 transition-colors text-sm border-t border-dashed border-gray-100 pt-4"
      >
        <FolderPlus size={16} />
        <span>New Library</span>
      </button>
    </nav>
  );

  const bookRow = (book: BookMetadata) => (
    <div
      key={book.id}
      onClick={() => openBook(book)}
      className={cn(
        "group flex items-center cursor-pointer transition-all",
        isMobile
          ? "px-4 py-3.5 border-b border-gray-100"
          : "px-4 py-2.5 hover:bg-gray-50 rounded-lg border border-transparent hover:border-gray-100",
      )}
    >
      <div className="flex-[3] flex items-center gap-3 overflow-hidden">
        <div
          className={cn(
            "w-2 h-2 rounded-full flex-shrink-0 transition-colors",
            isMobile ? "bg-orange-300" : "bg-gray-200 group-hover:bg-orange-400",
          )}
        />
        <span className="font-medium text-sm text-gray-800 truncate">{book.title}</span>
        {book.author && (
          <>
            <span className="text-xs text-gray-400 select-none">·</span>
            <span className="text-xs text-gray-500 truncate">{book.author}</span>
          </>
        )}
      </div>

      {!isMobile && (
        <div className="flex-1 flex justify-end items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-all">
            <MoreVertical size={14} />
          </button>
          <div className="text-orange-500 ml-2">
            <ChevronRight size={16} />
          </div>
        </div>
      )}
      {isMobile && (
        <div className="text-gray-300 ml-2">
          <ChevronRight size={16} />
        </div>
      )}
    </div>
  );

  const emptyState = loading ? (
    <div className="flex flex-col items-center justify-center py-24 text-gray-400">
      <p className="text-sm">Loading...</p>
    </div>
  ) : searchQuery ? (
    <div className="flex flex-col items-center justify-center py-24 text-gray-400">
      <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
        <Search size={24} className="opacity-20" />
      </div>
      <p className="text-sm">No books found matching &ldquo;{searchQuery}&rdquo;</p>
      <button
        onClick={() => setSearchQuery("")}
        className="mt-2 text-xs text-orange-500 hover:underline"
      >
        Clear search
      </button>
    </div>
  ) : (
    <div className="flex flex-col items-center justify-center py-24 text-gray-400">
      <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
        <BookOpen size={24} className="opacity-20" />
      </div>
      <p className="text-sm">Add a library folder to get started</p>
    </div>
  );

  // --- MOBILE LAYOUT ---
  if (isMobile) {
    return (
      <div className="flex flex-col h-screen w-full bg-[#FDFDFD] text-[#1A1A1A] font-sans selection:bg-orange-100 overflow-hidden">
        <div className="flex-shrink-0 bg-white border-b border-gray-100 z-20">
          <div className="flex items-center gap-2 px-3 h-11">
            <button
              onClick={() => setSheetOpen(true)}
              className="flex items-center justify-center w-9 h-9 text-gray-500 active:bg-gray-100 transition-colors"
            >
              <Library size={18} />
            </button>
            <div className="flex-1 relative group">
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-orange-500 transition-colors"
              />
              <input
                ref={searchRef}
                type="text"
                placeholder="Search..."
                className="w-full h-8 pl-8 pr-3 bg-gray-50 border border-transparent focus:bg-white focus:border-orange-200 text-base text-gray-800 placeholder:text-gray-400 outline-none transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="w-full h-24 overflow-hidden relative">
            <ASCIIMatrixStream autoPlay />
          </div>
          <div className="pb-6">
            {books.map(bookRow)}
            {books.length === 0 && emptyState}
          </div>
        </div>

        <AnimatePresence>
          {sheetOpen && (
            <>
              <motion.div
                className="fixed inset-0 bg-black/30 z-30"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSheetOpen(false)}
              />
              <motion.div
                className="fixed bottom-0 left-0 right-0 z-40 bg-white rounded-t-2xl max-h-[70vh] flex flex-col"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 28, stiffness: 300 }}
              >
                <div className="flex justify-center pt-3 pb-1">
                  <div className="w-10 h-1 rounded-full bg-gray-300" />
                </div>
                <div className="flex items-center justify-between px-4 pb-2">
                  <span className="text-sm font-semibold text-gray-800">Libraries</span>
                  <button
                    onClick={() => setSheetOpen(false)}
                    className="p-1.5 text-gray-400 active:text-gray-600 rounded-full"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="overflow-y-auto pb-8">{collectionsNav}</div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // --- DESKTOP LAYOUT ---
  return (
    <div className="flex h-screen w-full bg-[#FDFDFD] text-[#1A1A1A] font-sans selection:bg-orange-100 overflow-hidden">
      <aside className="w-64 border-r border-gray-100 flex flex-col bg-white relative overflow-hidden">
        <SidebarShimmer />
        <div className="relative h-28 overflow-hidden flex-shrink-0">
          <ASCIIMatrixStream autoPlay />
        </div>
        <div className="flex-1 relative">{collectionsNav}</div>
      </aside>

      <main className="flex-1 flex flex-col h-full bg-white relative">
        <header className="h-16 border-b border-gray-50 px-8 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md z-10">
          <div className="flex items-center flex-1 max-w-md relative group">
            <Search
              size={16}
              className="absolute left-3 text-gray-400 group-focus-within:text-orange-500 transition-colors"
            />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search by title or author..."
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border-transparent focus:bg-white focus:ring-1 focus:ring-orange-100 focus:border-orange-200 rounded-lg text-sm transition-all outline-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={pickDirectory}
              className="group relative px-3 py-1 text-xs font-semibold uppercase tracking-widest text-orange-600 hover:text-white border border-orange-300 hover:border-orange-500 overflow-hidden transition-colors duration-150 active:scale-95"
            >
              <span className="absolute inset-0 bg-orange-500 origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-200 ease-out" />
              <span className="relative z-10 flex items-center gap-1.5">
                <Plus size={12} strokeWidth={3} />
                Import
              </span>
            </button>
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-8 py-6 scroll-smooth">
          <div className="space-y-[1px]">
            {books.map(bookRow)}
            {books.length === 0 && emptyState}
          </div>
        </div>
      </main>
    </div>
  );
});
