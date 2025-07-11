import { ArrowLeft, Menu } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useCallback, useState } from "react";
import { BookReader } from "./ChapterRenderer";
import { BookLibrary } from "./components/BookLibrary";
import { TableOfContents } from "./components/TableOfContents";
import { useBookLibraryStore, useEpubStore } from "./stores/RootStore";

export const App = observer(() => {
  const epubStore = useEpubStore();
  const bookLibraryStore = useBookLibraryStore();
  const [currentBookId, setCurrentBookId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { epub, isLoading, currentChapterIndex, chapters } = epubStore;

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

  const handleTocChapterSelect = useCallback(
    (href: string) => {
      // Extract the file path without anchor
      const filePath = href.split("#")[0];

      // Find the chapter index by matching the path
      const chapterIndex = chapters.findIndex((chapter) => {
        // Compare the relative paths
        const chapterPath = chapter.path;
        const tocBasePath = epub?.opf.base || "";

        // Simple path resolution - might need adjustment based on actual epub structure
        const resolvedHref = filePath.startsWith("/")
          ? filePath
          : `${tocBasePath}/${filePath}`.replace(/\/+/g, "/");

        return chapterPath === resolvedHref || chapterPath.endsWith(filePath);
      });

      if (chapterIndex !== -1) {
        epubStore.setCurrentChapter(chapterIndex);
        setIsSidebarOpen(false); // Close sidebar on mobile after selection
      }
    },
    [chapters, epub, epubStore],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl">Loading EPUB...</div>
      </div>
    );
  }

  if (epub && currentBookId) {
    const currentChapter = chapters[currentChapterIndex];

    return (
      <div className="flex h-screen bg-gray-50">
        {/* Sidebar */}
        <div
          className={`fixed lg:static inset-y-0 left-0 z-20 w-80 bg-white shadow-lg transform transition-transform duration-200 ease-in-out ${
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
            className="fixed inset-0 bg-black bg-opacity-50 z-10 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
            aria-label="Close sidebar"
          />
        )}
      </div>
    );
  }

  return <BookLibrary onOpenBook={handleOpenBook} />;
});
