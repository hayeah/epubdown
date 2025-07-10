import { observer } from "mobx-react-lite";
import { useCallback, useEffect, useState } from "react";
import { BookReader } from "./ChapterRenderer";
import { BookLibrary } from "./components/BookLibrary";
import { useBookLibraryStore, useEpubStore } from "./stores/RootStore";

export const App = observer(() => {
  const epubStore = useEpubStore();
  const bookLibraryStore = useBookLibraryStore();
  const [currentBookId, setCurrentBookId] = useState<string | null>(null);
  const { epub, isLoading, currentChapterIndex } = epubStore;

  const loadBook = useCallback(
    async (bookId: string) => {
      const bookData = await bookLibraryStore.loadBookForReading(bookId);
      if (bookData) {
        setCurrentBookId(bookId);

        // Convert Blob to File for EPubStore
        const file = new File(
          [bookData.blob],
          `${bookData.metadata.title}.epub`,
          {
            type: "application/epub+zip",
          },
        );

        await epubStore.loadEpub(file);

        // Jump to saved chapter if available
        if (bookData.metadata.currentChapter) {
          epubStore.setCurrentChapter(bookData.metadata.currentChapter);
        }
      }
    },
    [bookLibraryStore, epubStore],
  );

  const handleOpenBook = (bookId: string) => {
    // Update URL
    const url = new URL(window.location.href);
    url.searchParams.set("book", bookId);
    window.history.pushState({}, "", url.toString());

    loadBook(bookId);
  };

  const closeBook = useCallback(() => {
    // Save progress before closing
    if (currentBookId && epub) {
      const progress = currentChapterIndex / (epub.spine.length - 1);
      bookLibraryStore.updateReadingProgress(
        currentBookId,
        progress,
        currentChapterIndex,
      );
    }

    // Clear URL
    const url = new URL(window.location.href);
    url.searchParams.delete("book");
    window.history.pushState({}, "", url.toString());

    // Reset state
    setCurrentBookId(null);
    epubStore.reset();
  }, [currentBookId, epub, currentChapterIndex, bookLibraryStore, epubStore]);

  // Handle browser navigation
  useEffect(() => {
    const handlePopState = () => {
      const bookId = new URLSearchParams(window.location.search).get("book");
      if (bookId && bookId !== currentBookId) {
        loadBook(bookId);
      } else if (!bookId && currentBookId) {
        closeBook();
      }
    };

    // Check initial URL
    const initialBookId = new URLSearchParams(window.location.search).get(
      "book",
    );
    if (initialBookId) {
      loadBook(initialBookId);
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [currentBookId, loadBook, closeBook]);

  const handleChapterChange = (index: number) => {
    epubStore.setCurrentChapter(index);

    // Save progress periodically
    if (currentBookId && epub) {
      const progress = index / (epub.spine.length - 1);
      bookLibraryStore.updateReadingProgress(currentBookId, progress, index);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl">Loading EPUB...</div>
      </div>
    );
  }

  if (epub && currentBookId) {
    return (
      <div>
        <div className="fixed top-0 left-0 right-0 bg-white shadow-sm z-10 p-4">
          <button
            type="button"
            onClick={closeBook}
            className="flex items-center text-blue-600 hover:text-blue-800"
          >
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Back to Library
          </button>
        </div>
        <div className="pt-16">
          <BookReader
            epub={epub}
            currentChapterIndex={currentChapterIndex}
            onChapterChange={handleChapterChange}
          />
        </div>
      </div>
    );
  }

  return <BookLibrary onOpenBook={handleOpenBook} />;
});
