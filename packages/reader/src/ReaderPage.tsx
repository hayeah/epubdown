import { Menu } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { BookReader } from "./ChapterRenderer";
import { Sidebar } from "./components/Sidebar";
import { TableOfContents } from "./components/TableOfContents";
import { useBookLibraryStore, useReaderStore } from "./stores/RootStore";

export const ReaderPage = observer(() => {
  const readerStore = useReaderStore();
  const bookLibraryStore = useBookLibraryStore();
  const [, navigate] = useLocation();
  const [match, params] = useRoute("/book/:bookId/:chapterIndex?");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Check if mobile on mount and window resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024); // lg breakpoint
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);
  const { epub, currentChapterIndex, chapters } = readerStore;
  const readerContentRef = useRef<HTMLDivElement>(null);

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

  // Shared callback to scroll reader content to top
  const scrollToTop = useCallback(() => {
    if (readerContentRef.current) {
      readerContentRef.current.scrollTop = 0;
    }
  }, []);

  // Load book when component mounts or bookId changes
  useEffect(() => {
    if (bookId && match) {
      loadBook(bookId);
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
        scrollToTop();
      }
    }
  }, [
    epub,
    match,
    params?.chapterIndex,
    currentChapterIndex,
    chapters.length,
    readerStore,
    scrollToTop,
  ]);

  const handleChapterChange = (index: number) => {
    if (bookId) {
      readerStore.handleChapterChange(navigate, bookId, index);
      scrollToTop();
    }
  };

  const handleTocChapterSelect = useCallback(
    (href: string) => {
      if (
        bookId &&
        readerStore.handleTocChapterSelect(navigate, bookId, href)
      ) {
        setIsSidebarOpen(false); // Close sidebar on mobile after selection
        scrollToTop();
      }
    },
    [readerStore, bookId, navigate, scrollToTop],
  );

  // Not a reader route
  if (!match) {
    return null;
  }

  if (epub && bookId) {
    const currentChapter = chapters[currentChapterIndex];

    return (
      <div className="h-screen bg-gray-50 overflow-hidden">
        {/* Fixed container for centering */}
        <div className="h-full flex justify-center">
          <div className="max-w-4xl w-full relative">
            {/* Sidebar - absolutely positioned */}
            <Sidebar
              isOpen={isSidebarOpen}
              onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
            >
              <TableOfContents
                epub={epub}
                currentChapterPath={currentChapter?.path}
                onChapterSelect={handleTocChapterSelect}
                onClose={() => setIsSidebarOpen(false)}
              />
            </Sidebar>

            {/* Main content - scrollable */}
            <div className="h-screen overflow-auto" ref={readerContentRef}>
              <div className="p-8">
                {/* Mobile menu button */}
                {isMobile && (
                  <div className="fixed top-4 left-4 z-30">
                    <button
                      type="button"
                      onClick={() => setIsSidebarOpen(true)}
                      className="p-2 bg-white shadow-md rounded-lg hover:shadow-lg transition-shadow"
                      aria-label="Open menu"
                    >
                      <Menu className="w-6 h-6" />
                    </button>
                  </div>
                )}

                <BookReader
                  epub={epub}
                  currentChapterIndex={currentChapterIndex}
                  onChapterChange={handleChapterChange}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Still loading or no book selected
  return null;
});
