import type { EPub, XMLFile } from "@epubdown/core";
import parse, {
  domToReact,
  type Element,
  type DOMNode,
} from "html-react-parser";
import { marked } from "marked";
import { observer } from "mobx-react-lite";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { Footnote, Image } from "./MarkdownComponents";
import { ChapterNavigation } from "./components/ChapterNavigation";
import { SelectionPopover } from "./components/SelectionPopover";
import { useReadingProgress } from "./stores/ReadingProgressStore";
import { useReaderStore } from "./stores/RootStore";
import {
  copyToClipboard,
  formatSelectionWithContext,
  getSelectionContext,
} from "./utils/selectionUtils";

import htmlToDOM from "html-dom-parser";

// Chapter renderer component that puts everything together
export interface ChapterRendererProps {
  xmlFile: XMLFile;
  className?: string;
}

export const ChapterRenderer: React.FC<ChapterRendererProps> = observer(
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

// Book reader component that handles multiple chapters
export interface BookReaderProps {
  epub: EPub;
  currentChapterIndex?: number;
  onChapterChange?: (index: number) => void;
  className?: string;
}

export const BookReader: React.FC<BookReaderProps> = observer(
  ({ epub, currentChapterIndex = 0, onChapterChange, className }) => {
    const readerStore = useReaderStore();
    const readingProgress = useReadingProgress();
    const { chapters, metadata } = readerStore;

    const currentChapter = chapters[currentChapterIndex];

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

    return (
      <div className={`book-reader ${className || ""}`}>
        {/* Selection popover for copy with context */}
        <SelectionPopover onCopyWithContext={handleCopyWithContext} />

        {/* Chapter Navigation Widget */}
        <ChapterNavigation
          epub={epub}
          currentChapterIndex={currentChapterIndex}
          totalChapters={chapters.length}
          currentChapterPath={currentChapter?.path}
          bookTitle={metadata.title}
          onChapterChange={onChapterChange}
        />

        {/* Current chapter */}
        {currentChapter && (
          <ChapterRenderer
            xmlFile={currentChapter}
            className="current-chapter"
          />
        )}
      </div>
    );
  },
);
