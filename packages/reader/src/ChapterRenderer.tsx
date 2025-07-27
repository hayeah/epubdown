import type { EPub, XMLFile } from "@epubdown/core";
import parse, { domToReact, Element, type DOMNode } from "html-react-parser";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { marked } from "marked";
import { observer } from "mobx-react-lite";
import React, { useState, useEffect } from "react";
import { Footnote, Image } from "./MarkdownComponents";
import { useReaderStore } from "./stores/RootStore";

import htmlToDOM from "html-dom-parser";

// Chapter renderer component that puts everything together
export interface ChapterRendererProps {
  xmlFile: XMLFile;
  className?: string;
}

export const ChapterRenderer: React.FC<ChapterRendererProps> = observer(
  ({ xmlFile, className }) => {
    const readerStore = useReaderStore();
    const [markdownResult, setMarkdownResult] = useState<{
      markdown: string;
      reactTree: React.ReactNode;
    } | null>(null);
    const [error, setError] = useState<string | null>(null);

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
          <div className="chapter-content">{markdownResult.reactTree}</div>
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
    const { chapters, metadata } = readerStore;

    const currentChapter = chapters[currentChapterIndex];
    const hasPrevious = currentChapterIndex > 0;
    const hasNext = currentChapterIndex < chapters.length - 1;

    const handlePrevious = () => {
      if (hasPrevious) {
        onChapterChange?.(currentChapterIndex - 1);
      }
    };

    const handleNext = () => {
      if (hasNext) {
        onChapterChange?.(currentChapterIndex + 1);
      }
    };

    return (
      <div className={`book-reader ${className || ""}`}>
        {/* Chapter navigation - redesigned for top of content */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <button
              type="button"
              onClick={handlePrevious}
              disabled={!hasPrevious}
              className={`p-2 rounded-lg transition-colors ${
                hasPrevious
                  ? "text-gray-600 hover:bg-gray-100 hover:text-gray-900 cursor-pointer"
                  : "text-gray-300 cursor-not-allowed"
              }`}
              aria-label="Previous chapter"
            >
              <ChevronLeft size={24} />
            </button>

            <span className="text-sm text-gray-500">
              Chapter {currentChapterIndex + 1} of {chapters.length}
            </span>

            <button
              type="button"
              onClick={handleNext}
              disabled={!hasNext}
              className={`p-2 rounded-lg transition-colors ${
                hasNext
                  ? "text-gray-600 hover:bg-gray-100 hover:text-gray-900 cursor-pointer"
                  : "text-gray-300 cursor-not-allowed"
              }`}
              aria-label="Next chapter"
            >
              <ChevronRight size={24} />
            </button>
          </div>

          {/* Book header */}
          <header className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 leading-tight m-0">
              {metadata.title}
            </h1>
            {metadata.author && (
              <p className="text-gray-600 mt-2 mb-0 text-lg">
                by {metadata.author}
              </p>
            )}
          </header>
        </div>

        <hr className="border-gray-200 mb-8" />

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
