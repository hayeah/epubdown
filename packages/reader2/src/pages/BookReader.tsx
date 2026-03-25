import { ContentToMarkdown } from "@epubdown/core";
import { ArrowLeft, ChevronLeft, ChevronRight, List, X } from "lucide-react";
import { observer } from "mobx-react-lite";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { markdownToReact } from "../markdown/markdownToReact";
import { useReaderStore } from "../stores/RootStore";
import { useLocation, useParams } from "wouter";

const __DOC__ = `
# BookReader

Page for reading an EPUB book chapter by chapter.

## window.__agent

- store — ReaderStore (MobX observable)
  - store.currentChapterIndex (number)
  - store.currentBookId (number | null)
  - store.isSidebarOpen (boolean)
  - store.metadata — book metadata object
  - store.navItems — flat nav items from TOC
- nextChapter() — go to next chapter
- previousChapter() — go to previous chapter
- setChapter(index) — jump to chapter by index
- toggleSidebar() — toggle TOC sidebar
- $chapterContent — the chapter content container
- $sidebar — the sidebar element
`;

const ChapterContent: React.FC = observer(() => {
  const readerStore = useReaderStore();
  const [content, setContent] = useState<React.ReactNode>(null);
  const [loading, setLoading] = useState(true);

  const chapter = readerStore.currentChapter;
  const chapterIndex = readerStore.currentChapterIndex;

  useEffect(() => {
    if (!chapter) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      const converter = ContentToMarkdown.create({ basePath: chapter.base });
      const markdown = await converter.convertXMLFile(chapter);
      const reactContent = await markdownToReact(markdown);
      if (!cancelled) {
        setContent(reactContent);
        setLoading(false);
        // Scroll to top on chapter change
        window.scrollTo(0, 0);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [chapter, chapterIndex]);

  if (loading) {
    return <div className="text-center py-16 text-stone-400">Loading chapter...</div>;
  }

  return <>{content}</>;
});

const TocSidebar: React.FC<{ sidebarRef: React.RefObject<HTMLDivElement | null> }> = observer(
  ({ sidebarRef }) => {
    const readerStore = useReaderStore();
    const { navItems, currentChapterIndex } = readerStore;

    return (
      <div
        ref={sidebarRef}
        className={`fixed inset-y-0 left-0 z-40 w-80 bg-white border-r border-stone-200 shadow-lg transform transition-transform duration-300 ${
          readerStore.isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-stone-200">
          <h2 className="font-semibold text-stone-800">Table of Contents</h2>
          <button
            type="button"
            onClick={() => readerStore.setSidebarOpen(false)}
            className="p-1 rounded hover:bg-stone-100"
          >
            <X className="w-5 h-5 text-stone-500" />
          </button>
        </div>
        <nav className="overflow-y-auto h-[calc(100%-57px)] py-2">
          {navItems.map((item, i) => {
            const chapterIdx = readerStore.findChapterIndexByPath(item.path);
            const isActive = chapterIdx === currentChapterIndex;
            return (
              <button
                key={`${item.path}-${i}`}
                type="button"
                onClick={() => {
                  readerStore.handleTocChapterSelect(item.path);
                  readerStore.setSidebarOpen(false);
                }}
                className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-orange-50 text-orange-700 font-medium"
                    : "text-stone-600 hover:bg-stone-50"
                }`}
                style={{ paddingLeft: `${1 + item.level * 1}rem` }}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>
    );
  },
);

export const BookReader: React.FC = observer(() => {
  const readerStore = useReaderStore();
  const params = useParams<{ bookId: string; chapterIndex?: string }>();
  const [, navigate] = useLocation();
  const contentRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  const bookId = params.bookId ? Number(params.bookId) : null;
  const chapterIndex = params.chapterIndex !== undefined ? Number(params.chapterIndex) : undefined;

  // Wire navigate
  useEffect(() => {
    readerStore.setNavigate(navigate);
  }, [readerStore, navigate]);

  // Load book
  useEffect(() => {
    if (!bookId) return;
    setError(null);
    readerStore.loadBookAndChapter(bookId, chapterIndex).catch((err) => {
      setError(err.message);
    });
  }, [readerStore, bookId, chapterIndex]);

  // Register __agent
  useEffect(() => {
    (window as any).__agent = {
      store: readerStore,
      nextChapter: () => readerStore.handleChapterChange(readerStore.currentChapterIndex + 1),
      previousChapter: () => readerStore.handleChapterChange(readerStore.currentChapterIndex - 1),
      setChapter: (index: number) => readerStore.handleChapterChange(index),
      toggleSidebar: () => readerStore.toggleSidebar(),
      get $chapterContent() {
        return contentRef.current;
      },
      get $sidebar() {
        return sidebarRef.current;
      },
    };
    return () => {
      (window as any).__agent = null;
    };
  });

  // Close sidebar on outside click
  useEffect(() => {
    if (!readerStore.isSidebarOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        readerStore.setSidebarOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [readerStore.isSidebarOpen, readerStore]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <a href="/" className="text-orange-600 hover:underline">
            Back to library
          </a>
        </div>
      </div>
    );
  }

  if (!readerStore.epub) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <p className="text-stone-400">Loading book...</p>
      </div>
    );
  }

  const {
    metadata,
    currentChapterTitle,
    hasNextChapter,
    hasPreviousChapter,
    currentChapterIndex: chapIdx,
  } = readerStore;

  return (
    <div className="min-h-screen bg-stone-50">
      <TocSidebar sidebarRef={sidebarRef} />

      {/* Overlay when sidebar is open */}
      {readerStore.isSidebarOpen && <div className="fixed inset-0 z-30 bg-black/20" />}

      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => readerStore.toggleSidebar()}
            className="p-1.5 rounded-lg hover:bg-stone-100"
            title="Table of Contents"
          >
            <List className="w-5 h-5 text-stone-600" />
          </button>
          <a href="/" className="p-1.5 rounded-lg hover:bg-stone-100" title="Back to library">
            <ArrowLeft className="w-5 h-5 text-stone-600" />
          </a>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-stone-800 truncate">{metadata.title}</div>
            {currentChapterTitle && (
              <div className="text-xs text-stone-400 truncate">{currentChapterTitle}</div>
            )}
          </div>
        </div>
      </header>

      {/* Chapter content */}
      <main className="mx-auto max-w-3xl px-6 py-8">
        <article
          ref={contentRef}
          className="prose prose-stone prose-headings:text-stone-800 prose-p:text-stone-700 prose-p:leading-relaxed prose-a:text-orange-700 max-w-none"
        >
          <ChapterContent />
        </article>

        {/* Chapter navigation */}
        <div className="flex items-center justify-between mt-12 mb-8 pt-8 border-t border-stone-200">
          <button
            type="button"
            onClick={() => readerStore.handleChapterChange(chapIdx - 1)}
            disabled={!hasPreviousChapter}
            className="flex items-center gap-2 px-4 py-2 text-sm text-stone-600 hover:text-stone-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>
          <button
            type="button"
            onClick={() => readerStore.handleChapterChange(chapIdx + 1)}
            disabled={!hasNextChapter}
            className="flex items-center gap-2 px-4 py-2 text-sm text-stone-600 hover:text-stone-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </main>
    </div>
  );
});
