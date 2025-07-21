import { ArrowLeft, Menu } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useCallback, useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { BookReader } from "./ChapterRenderer";
import { TableOfContents } from "./components/TableOfContents";
import { useBookLibraryStore, useReaderStore } from "./stores/RootStore";

export const ReaderPage = observer(() => {
  const readerStore = useReaderStore();
  const bookLibraryStore = useBookLibraryStore();
  const [, navigate] = useLocation();
  const [match, params] = useRoute("/book/:bookId/:chapterIndex?");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { epub, currentChapterIndex, chapters } = readerStore;

  const bookId = match ? params?.bookId : null;
  const initialChapter = match ? Number(params?.chapterIndex ?? 0) : 0;

  const loadBook = useCallback(
    async (bookId: string) => {
      await readerStore.loadBookFromLibrary(
        navigate,
        bookId,
        bookLibraryStore,
        initialChapter,
      );
    },
    [bookLibraryStore, readerStore, initialChapter, navigate],
  );

  // Load book when component mounts or bookId changes
  useEffect(() => {
    if (bookId && match) {
      loadBook(bookId).catch(() => {
        // Error handling is done in loadBookFromLibrary
      });
    }
  }, [bookId, match, loadBook]);

  // Update chapter when URL changes
  useEffect(() => {
    if (epub && match && params?.chapterIndex !== undefined) {
      const newChapterIndex = Number(params.chapterIndex);
      if (
        newChapterIndex !== currentChapterIndex &&
        newChapterIndex < chapters.length
      ) {
        readerStore.setChapter(newChapterIndex);
      }
    }
  }, [
    epub,
    match,
    params?.chapterIndex,
    currentChapterIndex,
    chapters.length,
    readerStore,
  ]);

  const closeBook = useCallback(() => {
    readerStore.handleCloseBook(navigate);
  }, [readerStore, navigate]);

  const handleChapterChange = (index: number) => {
    if (bookId) {
      readerStore.handleChapterChange(navigate, bookId, index);
    }
  };

  const handleTocChapterSelect = useCallback(
    (href: string) => {
      if (
        bookId &&
        readerStore.handleTocChapterSelect(navigate, bookId, href)
      ) {
        setIsSidebarOpen(false); // Close sidebar on mobile after selection
      }
    },
    [readerStore, bookId, navigate],
  );

  // Not a reader route
  if (!match) {
    return null;
  }

  if (epub && bookId) {
    const currentChapter = chapters[currentChapterIndex];

    return (
      <div className="flex h-screen bg-gray-50">
        {/* Sidebar */}
        <div
          className={`fixed lg:relative inset-y-0 left-0 z-30 w-80 bg-white shadow-lg transform transition-transform duration-200 ease-in-out ${
            isSidebarOpen
              ? "translate-x-0"
              : "-translate-x-full lg:translate-x-0"
          }`}
        >
          <TableOfContents
            epub={epub}
            currentChapterPath={currentChapter?.path}
            onChapterSelect={handleTocChapterSelect}
            onClose={() => setIsSidebarOpen(false)}
          />
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-white shadow-sm z-10 p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="lg:hidden p-2 hover:bg-gray-100 rounded"
                aria-label="Toggle table of contents"
              >
                <Menu className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={closeBook}
                className="flex items-center text-blue-600 hover:text-blue-800"
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back to Library
              </button>
            </div>
          </div>

          {/* Reader */}
          <div className="flex-1 overflow-auto">
            <div className="max-w-4xl mx-auto p-4">
              <BookReader
                epub={epub}
                currentChapterIndex={currentChapterIndex}
                onChapterChange={handleChapterChange}
              />
            </div>
          </div>
        </div>

        {/* Mobile overlay */}
        {isSidebarOpen && (
          <button
            type="button"
            className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
            aria-label="Close sidebar"
          />
        )}
      </div>
    );
  }

  // Still loading or no book selected
  return null;
});
