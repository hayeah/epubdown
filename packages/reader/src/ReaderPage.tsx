import { ArrowLeft, Menu } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useCallback, useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { BookReader } from "./ChapterRenderer";
import { NotFound } from "./components/NotFound";
import { TableOfContents } from "./components/TableOfContents";
import {
  useBookLibraryStore,
  useEpubStore,
  useRootStore,
} from "./stores/RootStore";

export const ReaderPage = observer(() => {
  const epubStore = useEpubStore();
  const bookLibraryStore = useBookLibraryStore();
  const rootStore = useRootStore();
  const [, navigate] = useLocation();
  const [match, params] = useRoute("/book/:bookId/:chapterIndex?");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { epub, isLoading, currentChapterIndex, chapters } = epubStore;
  const [loadError, setLoadError] = useState<string | null>(null);

  const bookId = match ? params?.bookId : null;
  const initialChapter = match ? Number(params?.chapterIndex ?? 0) : 0;

  const loadBook = useCallback(
    async (bookId: string) => {
      const bookData = await bookLibraryStore.loadBookForReading(bookId);
      if (!bookData) {
        throw new Error("Book not found");
      }

      // Convert Blob to File for EPubStore
      const file = new File(
        [bookData.blob],
        `${bookData.metadata.title}.epub`,
        {
          type: "application/epub+zip",
        },
      );

      await epubStore.loadEpub(file);

      // Set initial chapter from URL or saved state
      const chapterToLoad =
        initialChapter || bookData.metadata.currentChapter || 0;
      epubStore.setCurrentChapter(chapterToLoad);
    },
    [bookLibraryStore, epubStore, initialChapter],
  );

  // Load book when component mounts or bookId changes
  useEffect(() => {
    if (bookId && match) {
      setLoadError(null);
      loadBook(bookId).catch((error) => {
        console.error("Failed to load book:", error);
        setLoadError("Book not found");
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
        epubStore.setCurrentChapter(newChapterIndex);
      }
    }
  }, [
    epub,
    match,
    params?.chapterIndex,
    currentChapterIndex,
    chapters.length,
    epubStore,
  ]);

  const closeBook = useCallback(() => {
    navigate("/");
    rootStore.reset();
  }, [navigate, rootStore]);

  const handleChapterChange = (index: number) => {
    if (bookId) {
      navigate(`/book/${bookId}/${index}`, { replace: true });
      epubStore.setCurrentChapter(index);
    }
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

      if (chapterIndex !== -1 && bookId) {
        navigate(`/book/${bookId}/${chapterIndex}`, { replace: true });
        epubStore.setCurrentChapter(chapterIndex);
        setIsSidebarOpen(false); // Close sidebar on mobile after selection
      }
    },
    [chapters, epub, epubStore, bookId, navigate],
  );

  // Handle errors
  if (loadError) {
    return <NotFound />;
  }

  // Not a reader route
  if (!match) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl">Loading EPUB...</div>
      </div>
    );
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
