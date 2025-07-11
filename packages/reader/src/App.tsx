import { ArrowLeft } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useCallback, useState } from "react";
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
    loadBook(bookId);
  };

  const closeBook = useCallback(() => {
    // Reset state
    setCurrentBookId(null);
    epubStore.reset();
  }, [epubStore]);

  const handleChapterChange = (index: number) => {
    epubStore.setCurrentChapter(index);
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
            <ArrowLeft className="w-5 h-5 mr-2" />
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
