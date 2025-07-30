import { Menu } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useEffect, useRef, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { BookReader } from "./ChapterRenderer";
import { Sidebar } from "./components/Sidebar";
import { TableOfContents } from "./components/TableOfContents";
import { useReaderStore } from "./stores/RootStore";

export const ReaderPage = observer(() => {
  const readerStore = useReaderStore();
  const [location, navigate] = useLocation();
  const [match, params] = useRoute("/book/:bookId/:chapterIndex?");
  const [isMobile, setIsMobile] = useState(false);
  const lastProcessedUrl = useRef<string>("");

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

  const bookId = match ? params?.bookId : null;
  const initialChapter = match ? Number(params?.chapterIndex ?? 0) : 0;

  // Set navigate function on ReaderStore
  useEffect(() => {
    readerStore.setNavigate(navigate);
  }, [readerStore, navigate]);

  // Handle URL changes
  useEffect(() => {
    if (match && params?.bookId && location !== lastProcessedUrl.current) {
      lastProcessedUrl.current = location;
      readerStore.handleUrlChange(location);
    }
  }, [match, params?.bookId, location, readerStore]);

  // Update page title when chapter or book changes
  useEffect(() => {
    const updatePageTitle = async () => {
      if (!epub || !bookId) return;

      const currentChapter = chapters[currentChapterIndex];
      if (!currentChapter) return;

      // Get chapter title from TOC
      const chapterTitle = await readerStore.getChapterTitleFromToc(
        currentChapter.path,
      );
      const bookTitle = readerStore.metadata.title || "Unknown Book";

      // Update document title
      if (chapterTitle) {
        document.title = `${chapterTitle} | ${bookTitle}`;
      } else {
        // Fallback to chapter filename if no TOC entry
        const chapterName =
          currentChapter.name || `Chapter ${currentChapterIndex + 1}`;
        document.title = `${chapterName} | ${bookTitle}`;
      }
    };

    updatePageTitle();
  }, [epub, bookId, currentChapterIndex, chapters, readerStore]);

  // Not a reader route
  if (!match) {
    return null;
  }

  if (epub && bookId) {
    const currentChapter = chapters[currentChapterIndex];

    return (
      <div className="min-h-screen bg-gray-50">
        {/* Main content - scrollable full screen */}
        <div className="min-h-screen">
          {/* Fixed container for centering content */}
          <div className="min-h-full flex justify-center relative">
            <div className="max-w-4xl w-full relative">
              {/* Sticky anchor for sidebar positioning */}
              <div className="sticky top-0 h-0 relative">
                <Sidebar
                  isOpen={readerStore.isSidebarOpen}
                  onToggle={() => readerStore.toggleSidebar()}
                >
                  <TableOfContents />
                </Sidebar>
              </div>

              <div className="p-8">
                {/* Mobile menu button */}
                {isMobile && (
                  <div className="fixed top-4 left-4 z-30">
                    <button
                      type="button"
                      onClick={() => readerStore.setSidebarOpen(true)}
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
                  onChapterChange={(index) =>
                    readerStore.handleChapterChange(index)
                  }
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
