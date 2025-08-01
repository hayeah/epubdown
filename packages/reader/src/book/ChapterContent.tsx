import { observer } from "mobx-react-lite";
import { useEffect, useRef } from "react";
import { useReadingProgress } from "../stores/ReadingProgressStore";
import { useReaderStore } from "../stores/RootStore";

// Chapter content component that renders the chapter
export interface ChapterContentProps {
  className?: string;
}

export const ChapterContent: React.FC<ChapterContentProps> = observer(
  ({ className }) => {
    const readerStore = useReaderStore();
    const readingProgress = useReadingProgress();
    const contentRef = useRef<HTMLDivElement>(null);

    const render = readerStore.currentChapterRender;

    // Set up IntersectionObserver for reading position tracking
    useEffect(() => {
      if (!render || !contentRef.current) return;

      const contentElement = contentRef.current;

      readingProgress.setup(contentElement);

      // Check if we should restore scroll position based on hash
      const hash = window.location.hash;
      if (hash?.startsWith("#p_")) {
        const position = readingProgress.parsePositionHash(hash);
        if (position !== null) {
          const targetBlock = readingProgress.getBlockByIndex(position);
          if (targetBlock) {
            // Add highlight class before scrolling
            targetBlock.classList.add("reading-progress-highlight");

            // Remove the highlight after animation completes
            setTimeout(() => {
              targetBlock.classList.remove("reading-progress-highlight");
            }, 5000);
          }
        }
        readingProgress.restoreScrollPosition(hash);
      } else {
        // No reading progress, scroll to top
        window.scrollTo(0, 0);
      }

      setTimeout(() => {
        // Start tracking only after scroll restoration is complete
        readingProgress.startTracking(contentElement);
      }, 100);

      return () => {
        readingProgress.stopTracking();
      };
    }, [render, readingProgress]);

    if (!render) {
      return (
        <div className="text-center p-8 text-gray-500">Loading chapter...</div>
      );
    }

    return (
      <article className={`epub-chapter ${className ?? ""}`}>
        <div className="chapter-content" ref={contentRef}>
          {render.reactTree}
        </div>
      </article>
    );
  },
);
