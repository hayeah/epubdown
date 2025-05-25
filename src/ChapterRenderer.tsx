import parse, { domToReact, Element, type DOMNode } from "html-react-parser";
import { marked } from "marked";
import React, { useState, useEffect } from "react";
import type { EPub, XMLFile } from "./Epub";
import { EPubResolverProvider, Footnote, Image } from "./MarkdownComponents";
import { MarkdownConverter, type MarkdownResult } from "./MarkdownConverter";

import htmlToDOM from 'html-dom-parser';

// Chapter renderer component that puts everything together
export interface ChapterRendererProps {
  xmlFile: XMLFile;
  className?: string;
}

export const ChapterRenderer: React.FC<ChapterRendererProps> = ({
  xmlFile,
  className,
}) => {
  const [markdownResult, setMarkdownResult] =
    React.useState<MarkdownResult | null>(null);
  const [reactTree, setReactTree] = React.useState<React.ReactNode>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const convertChapter = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const converter = new MarkdownConverter({
          imageComponent: "x-image",
          footnoteComponent: "x-footnote",
          enableViewportDetection: true,
          enableFootnoteHover: true,
        });

        const result = await converter.convertXMLFile(xmlFile);
        setMarkdownResult(result);

        // Convert markdown to HTML using marked
        const html = await marked.parse(result.content);

        // The parse options only work in node environment. In the browser
        // the built-in HTML parsing is used.
        //
        // const dom = htmlToDOM(html,{ lowerCaseTags: false });
        // console.log(dom)

        // Parse HTML to React components
        const tree = parse(html, {
          htmlparser2: { lowerCaseTags: false }, // keep tag-names exactly as written
          replace(domNode) {
            if (domNode.type === "tag" && domNode instanceof Element) {
              const tag = domNode.name;

              if (tag === "x-image") {
                const {
                  href,
                  alt,
                  title,
                  width,
                  height,
                  class: className,
                } = domNode.attribs;

                return (
                  <Image
                    href={href}
                    alt={alt}
                    title={title}
                    width={width ? Number.parseInt(width) : undefined}
                    height={height ? Number.parseInt(height) : undefined}
                    className={className}
                  />
                );
              }

              if (tag === "x-footnote") {
                const { href, id, class: className } = domNode.attribs;
                const children = domToReact(domNode.children as DOMNode[]);
                return (
                  <Footnote href={href} id={id} className={className}>
                    {children}
                  </Footnote>
                );
              }
            }
          },
        });

        setReactTree(tree);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to convert chapter",
        );
        console.error("Chapter conversion failed:", err);
      } finally {
        setIsLoading(false);
      }
    };

    convertChapter();
  }, [xmlFile]);

  if (isLoading) {
    return (
      <div className={`chapter-loading ${className || ""}`}>
        <div style={{ textAlign: "center", padding: "2rem", color: "#666" }}>
          Loading chapter...
        </div>
      </div>
    );
  }

  if (error || !markdownResult || !reactTree) {
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
        {markdownResult.title && (
          <header className="chapter-header">
            <h1>{markdownResult.title}</h1>
          </header>
        )}

        <div className="chapter-content">{reactTree}</div>

        {/* Debug info (remove in production) */}
        {process.env.NODE_ENV === "development" && (
          <details
            className="chapter-debug"
            style={{ marginTop: "2rem", fontSize: "0.8em" }}
          >
            <summary>Debug Info</summary>
            <pre
              style={{
                background: "#f5f5f5",
                padding: "1rem",
                overflow: "auto",
              }}
            >
              {JSON.stringify(
                {
                  title: markdownResult.title,
                  imageCount: markdownResult.images.length,
                  footnoteCount: markdownResult.footnotes.length,
                  images: markdownResult.images,
                  footnotes: markdownResult.footnotes,
                },
                null,
                2,
              )}
            </pre>
          </details>
        )}
      </article>
    </EPubResolverProvider>
  );
};

// Book reader component that handles multiple chapters
export interface BookReaderProps {
  epub: EPub;
  currentChapterIndex?: number;
  onChapterChange?: (index: number) => void;
  className?: string;
}

export const BookReader: React.FC<BookReaderProps> = ({
  epub,
  currentChapterIndex = 0,
  onChapterChange,
  className,
}) => {
  const [chapters, setChapters] = React.useState<XMLFile[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [metadata, setMetadata] = React.useState(epub.getMetadata());

  React.useEffect(() => {
    const loadChapters = async () => {
      try {
        setIsLoading(true);
        const chapterArray: XMLFile[] = [];

        for await (const chapter of epub.getChapters()) {
          chapterArray.push(chapter);
        }

        setChapters(chapterArray);
      } catch (error) {
        console.error("Failed to load chapters:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadChapters();
  }, [epub]);

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
        <ChapterRenderer xmlFile={currentChapter} className="current-chapter" />
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
};
