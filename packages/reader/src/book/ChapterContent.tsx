import type { XMLFile } from "@epubdown/core";
import { observer } from "mobx-react-lite";
import React, { useState, useEffect, useRef } from "react";
import { useReadingProgress } from "../stores/ReadingProgressStore";
import { useReaderStore } from "../stores/RootStore";

// Chapter content component that renders the chapter
export interface ChapterContentProps {
  xmlFile: XMLFile;
  className?: string;
}

export const ChapterContent: React.FC<ChapterContentProps> = observer(
  ({ xmlFile, className }) => {
    const readerStore = useReaderStore();
    const readingProgress = useReadingProgress();
    const [markdownResult, setMarkdownResult] = useState<{
      markdown: string;
      reactTree: React.ReactNode;
    } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const contentRef = useRef<HTMLDivElement>(null);

    React.useEffect(() => {
      let cancelled = false;

      const loadChapter = async () => {
        try {
          const result = await readerStore.getChapterReactTree(xmlFile);
          if (!cancelled) {
            setMarkdownResult(result);
            setError(null);
          }
        } catch (err) {
          if (!cancelled) {
            setError(
              err instanceof Error ? err.message : "Failed to load chapter",
            );
            setMarkdownResult(null);
          }
        }
      };

      loadChapter();

      return () => {
        cancelled = true;
      };
    }, [xmlFile, readerStore]);

    // Set up IntersectionObserver for reading position tracking
    useEffect(() => {
      if (!markdownResult || !contentRef.current) return;

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
    }, [markdownResult, readingProgress]);

    if (!markdownResult && !error) {
      return (
        <div className={`chapter-loading ${className || ""}`}>
          <div className="text-center p-8 text-gray-500">
            Loading chapter...
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className={`chapter-error ${className || ""}`}>
          <div className="text-center p-8 text-red-600 bg-red-50 border border-red-200 rounded">
            Error: {error}
          </div>
        </div>
      );
    }

    return (
      <article className={`epub-chapter ${className || ""}`}>
        {markdownResult?.reactTree && (
          <div className="chapter-content" ref={contentRef}>
            {markdownResult.reactTree}
          </div>
        )}
      </article>
    );
  },
);
