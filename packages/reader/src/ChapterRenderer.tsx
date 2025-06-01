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
          <div style={{ textAlign: "center", padding: "2rem", color: "#666" }}>
            Loading chapter...
          </div>
        </div>
      );
    }

    if (error || (!markdownResult && !isLoading)) {
      return (
        <div className={`chapter-error ${className || ""}`}>
          <div
            style={{
              textAlign: "center",
              padding: "2rem",
              color: "#cc0000",
              backgroundColor: "#ffe6e6",
              border: "1px solid #cc0000",
              borderRadius: "4px",
            }}
          >
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
          <div style={{ textAlign: "center", padding: "4rem" }}>
            <h2>Loading "{metadata.title || "Book"}"...</h2>
            <p>Please wait while we prepare your reading experience.</p>
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
        <header
          className="book-header"
          style={{
            borderBottom: "1px solid #eee",
            paddingBottom: "1rem",
            marginBottom: "2rem",
          }}
        >
          <h1 style={{ margin: 0, fontSize: "1.5em" }}>{metadata.title}</h1>
          {metadata.author && (
            <p style={{ margin: "0.5rem 0 0 0", color: "#666" }}>
              by {metadata.author}
            </p>
          )}
          <div
            style={{
              marginTop: "1rem",
              fontSize: "0.9em",
              color: "#999",
            }}
          >
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
        <nav
          className="chapter-navigation"
          style={{
            marginTop: "3rem",
            padding: "2rem 0",
            borderTop: "1px solid #eee",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <button
            type="button"
            onClick={handlePrevious}
            disabled={!hasPrevious}
            style={{
              padding: "0.75rem 1.5rem",
              backgroundColor: hasPrevious ? "#0066cc" : "#ccc",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: hasPrevious ? "pointer" : "not-allowed",
            }}
          >
            ← Previous Chapter
          </button>

          <span style={{ color: "#666" }}>
            {currentChapterIndex + 1} / {chapters.length}
          </span>

          <button
            type="button"
            onClick={handleNext}
            disabled={!hasNext}
            style={{
              padding: "0.75rem 1.5rem",
              backgroundColor: hasNext ? "#0066cc" : "#ccc",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: hasNext ? "pointer" : "not-allowed",
            }}
          >
            Next Chapter →
          </button>
        </nav>
      </div>
    );
  },
);
