import type { EPub, MarkdownResult, XMLFile } from "@epubdown/core";
import parse, { domToReact, Element, type DOMNode } from "html-react-parser";
import { marked } from "marked";
import { observer } from "mobx-react-lite";
import React, { useState, useEffect } from "react";
import { EPubResolverProvider, Footnote, Image } from "./MarkdownComponents";
import { useChapterStore, useEpubStore } from "./stores/RootStore";

import htmlToDOM from "html-dom-parser";

// Chapter renderer component that puts everything together
export interface ChapterRendererProps {
  xmlFile: XMLFile;
  className?: string;
}

export const ChapterRenderer: React.FC<ChapterRendererProps> = observer(
  ({ xmlFile, className }) => {
    const chapterStore = useChapterStore();
    const epubStore = useEpubStore();

    // Get cached data from store
    const markdownResult = chapterStore.getChapterResult(xmlFile.path);
    const isLoading = chapterStore.isChapterLoading(xmlFile.path);
    const error = chapterStore.getChapterError(xmlFile.path);

    React.useEffect(() => {
      // Set converter if epub is loaded
      if (epubStore.epub && !chapterStore.converter) {
        chapterStore.setConverter(epubStore.epub);
      }

      // Load chapter if not already loaded or loading
      if (!markdownResult && !isLoading && !error) {
        chapterStore.loadChapter(xmlFile);
      }
    }, [
      xmlFile,
      epubStore.epub,
      markdownResult,
      isLoading,
      error,
      chapterStore,
    ]);

    if (isLoading) {
      return (
        <div className={`chapter-loading ${className || ""}`}>
          <div className="text-center p-8 text-gray-500">
            Loading chapter...
          </div>
        </div>
      );
    }

    if (error || (!markdownResult && !isLoading)) {
      return (
        <div className={`chapter-error ${className || ""}`}>
          <div className="text-center p-8 text-red-600 bg-red-50 border border-red-200 rounded">
            Error: {error || "Failed to load chapter"}
          </div>
        </div>
      );
    }

    return (
      <EPubResolverProvider resolver={xmlFile}>
        <article className={`epub-chapter ${className || ""}`}>
          {markdownResult?.reactTree && (
            <div className="chapter-content">{markdownResult.reactTree}</div>
          )}
        </article>
      </EPubResolverProvider>
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
    const epubStore = useEpubStore();
    const { chapters, metadata, isLoading } = epubStore;

    if (isLoading) {
      return (
        <div className={`book-loading ${className || ""}`}>
          <div className="text-center p-16">
            <h2 className="text-xl font-semibold mb-4">
              Loading "{metadata.title || "Book"}"...
            </h2>
            <p className="text-gray-600">
              Please wait while we prepare your reading experience.
            </p>
          </div>
        </div>
      );
    }

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
        {/* Book header */}
        <header className="border-b border-gray-200 pb-4 mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 leading-tight m-0">
            {metadata.title}
          </h1>
          {metadata.author && (
            <p className="text-gray-600 mt-2 mb-0">by {metadata.author}</p>
          )}
          <div className="text-sm text-gray-400 mt-4">
            Chapter {currentChapterIndex + 1} of {chapters.length}
          </div>
        </header>

        {/* Current chapter */}
        {currentChapter && (
          <ChapterRenderer
            xmlFile={currentChapter}
            className="current-chapter"
          />
        )}

        {/* Navigation */}
        <nav className="mt-12 pt-8 border-t border-gray-200 flex justify-between items-center">
          <button
            type="button"
            onClick={handlePrevious}
            disabled={!hasPrevious}
            className={`px-6 py-3 rounded text-white border-none ${
              hasPrevious
                ? "bg-blue-600 hover:bg-blue-700 cursor-pointer"
                : "bg-gray-400 cursor-not-allowed"
            }`}
          >
            ← Previous Chapter
          </button>

          <span className="text-gray-500">
            {currentChapterIndex + 1} / {chapters.length}
          </span>

          <button
            type="button"
            onClick={handleNext}
            disabled={!hasNext}
            className={`px-6 py-3 rounded text-white border-none ${
              hasNext
                ? "bg-blue-600 hover:bg-blue-700 cursor-pointer"
                : "bg-gray-400 cursor-not-allowed"
            }`}
          >
            Next Chapter →
          </button>
        </nav>
      </div>
    );
  },
);
