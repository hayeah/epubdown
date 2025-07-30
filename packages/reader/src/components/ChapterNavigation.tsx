import type { EPub } from "@epubdown/core";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useReaderStore } from "../stores/RootStore";

export interface ChapterNavigationProps {
  epub: EPub | null;
  currentChapterIndex: number;
  totalChapters: number;
  currentChapterPath?: string;
  bookTitle?: string;
  onChapterChange?: (index: number) => void;
}

export const ChapterNavigation: React.FC<ChapterNavigationProps> = ({
  epub,
  currentChapterIndex,
  totalChapters,
  currentChapterPath,
  bookTitle,
  onChapterChange,
}) => {
  const readerStore = useReaderStore();
  const [currentChapterTitle, setCurrentChapterTitle] = useState<string>("");
  const [isSticky, setIsSticky] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

  const hasPrevious = currentChapterIndex > 0;
  const hasNext = currentChapterIndex < totalChapters - 1;

  // Get current chapter title from TOC
  useEffect(() => {
    const getChapterTitle = async () => {
      if (!currentChapterPath) return;

      const title =
        await readerStore.getChapterTitleFromToc(currentChapterPath);
      setCurrentChapterTitle(title || `Chapter ${currentChapterIndex + 1}`);
    };

    getChapterTitle();
  }, [currentChapterPath, currentChapterIndex, readerStore]);

  // Detect when navigation becomes sticky
  useEffect(() => {
    const sentinel = document.createElement("div");
    sentinel.style.position = "absolute";
    sentinel.style.top = "0";
    sentinel.style.height = "1px";
    sentinel.style.visibility = "hidden";

    const navElement = navRef.current;
    if (!navElement) return;

    navElement.parentElement?.insertBefore(sentinel, navElement);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry) {
          setIsSticky(!entry.isIntersecting);
        }
      },
      { threshold: 1 },
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
      sentinel.remove();
    };
  }, []);

  const handlePrevious = () => {
    if (hasPrevious) {
      readerStore.handleChapterChange(currentChapterIndex - 1);
    }
  };

  const handleNext = () => {
    if (hasNext) {
      readerStore.handleChapterChange(currentChapterIndex + 1);
    }
  };

  return (
    <div ref={navRef} className="sticky top-2 z-40 w-full mb-4">
      <div
        className={`flex items-center justify-between py-2 px-2 transition-all duration-300 ${
          isSticky
            ? "bg-white/80 hover:bg-white/95 border border-gray-200 rounded-lg shadow-sm backdrop-blur-sm mx-8"
            : "border border-transparent"
        }`}
      >
        <button
          type="button"
          onClick={handlePrevious}
          disabled={!hasPrevious}
          className={`p-1 transition-colors ${
            hasPrevious
              ? "text-gray-600 hover:text-gray-900 cursor-pointer"
              : "text-gray-300 cursor-not-allowed"
          }`}
          aria-label="Previous chapter"
        >
          <ChevronLeft size={20} />
        </button>

        <div className="text-center flex-1 px-4">
          <div className="text-xs text-gray-500">{currentChapterTitle}</div>
          <div className="text-[10px] text-gray-400">
            {bookTitle || "Unknown Book"}
          </div>
        </div>

        <button
          type="button"
          onClick={handleNext}
          disabled={!hasNext}
          className={`p-1 transition-colors ${
            hasNext
              ? "text-gray-600 hover:text-gray-900 cursor-pointer"
              : "text-gray-300 cursor-not-allowed"
          }`}
          aria-label="Next chapter"
        >
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
};
