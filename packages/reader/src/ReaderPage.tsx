import { Menu } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { ChapterContent } from "./book/ChapterContent";
import { ChapterNavigation } from "./book/ChapterNavigation";
import { SelectionPopover } from "./book/SelectionPopover";
import { Sidebar } from "./book/Sidebar";
import { TableOfContents } from "./book/TableOfContents";
import { useReadingProgress } from "./stores/ReadingProgressStore";
import { useReaderStore } from "./stores/RootStore";
import {
  copyToClipboard,
  formatSelectionWithContext,
  getSelectionContext,
} from "./utils/selectionUtils";

export const ReaderPage = observer(() => {
  const readerStore = useReaderStore();
  const readingProgress = useReadingProgress();
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
  const { epub, currentChapterIndex, chapters, metadata } = readerStore;

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

  const handleCopyWithContext = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const context = getSelectionContext(selection);
    const formatted = formatSelectionWithContext(
      metadata.title || "Unknown Book",
      context,
    );
    copyToClipboard(formatted);
  }, [metadata.title]);

  // Keyboard shortcut for copy with context
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+Shift+C (Mac) or Ctrl+Shift+C (Windows/Linux)
      if (
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === "c"
      ) {
        e.preventDefault();
        handleCopyWithContext();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleCopyWithContext]);

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
                <Sidebar>
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

                <div className="book-reader">
                  {/* Selection popover for copy with context */}
                  <SelectionPopover onCopyWithContext={handleCopyWithContext} />

                  {/* Chapter Navigation Widget */}
                  <ChapterNavigation />

                  {/* Current chapter */}
                  {currentChapter && (
                    <ChapterContent className="current-chapter" />
                  )}
                </div>
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
