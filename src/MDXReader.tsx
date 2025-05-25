import { MDXProvider } from "@mdx-js/react";
import React, { useState, useEffect } from "react";
import { EPub, type XMLFile } from "./Epub";
import { EPubResolverProvider, createMDXComponents } from "./MDXComponents";
import { type MDXResult, XMLToMDXConverter } from "./MDXConverter";

import { evaluate } from "@mdx-js/mdx";
import * as runtime from "react/jsx-runtime";

const components = createMDXComponents();

export default function LiveMDX({ source }: { source: string }) {
  const [MDXContent, setMDXContent] = useState<React.ComponentType>(
    () => () => null,
  );

  useEffect(() => {
    let ignore = false;
    (async () => {
      // const components = createMDXComponents(); // Create components first

      const { default: Component } = await evaluate(source, {
        ...runtime,
        baseUrl: import.meta.url,
        useMDXComponents: createMDXComponents, // Spread the components so MDX can find them
        ...components,
      });

      if (!ignore) setMDXContent(() => Component); // Set the actual component, not "foobar"
    })();
    return () => {
      ignore = true;
    };
  }, [source]);

  return (
    <MDXProvider components={components}>
      <MDXContent />
    </MDXProvider>
  );
}

// Chapter renderer component that puts everything together
export interface ChapterRendererProps {
  xmlFile: XMLFile;
  className?: string;
}

export const ChapterRenderer: React.FC<ChapterRendererProps> = ({
  xmlFile,
  className,
}) => {
  const [mdxResult, setMdxResult] = React.useState<MDXResult | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const convertChapter = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const converter = new XMLToMDXConverter({
          imageComponent: "Image",
          footnoteComponent: "Footnote",
          enableViewportDetection: true,
          enableFootnoteHover: true,
        });

        const result = await converter.convertXMLFile(xmlFile);
        setMdxResult(result);
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

  if (error || !mdxResult) {
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

  // Create MDX components with resolver context
  const components = createMDXComponents();

  return (
    <EPubResolverProvider resolver={xmlFile}>
      <article className={`epub-chapter ${className || ""}`}>
        {mdxResult.title && (
          <header className="chapter-header">
            <h1>{mdxResult.title}</h1>
          </header>
        )}

        <div className="chapter-content">
          <LiveMDX source={mdxResult.content} />
        </div>

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
                  title: mdxResult.title,
                  imageCount: mdxResult.images.length,
                  footnoteCount: mdxResult.footnotes.length,
                  images: mdxResult.images,
                  footnotes: mdxResult.footnotes,
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

// Utility functions for integration

/**
 * Convert an entire EPub to MDX format and return all chapters
 */
export async function convertEPubToMDX(
  epub: EPub,
  options?: {
    imageComponent?: string;
    footnoteComponent?: string;
    onProgress?: (current: number, total: number) => void;
  },
): Promise<MDXResult[]> {
  const converter = new XMLToMDXConverter({
    imageComponent: options?.imageComponent || "Image",
    footnoteComponent: options?.footnoteComponent || "Footnote",
  });

  const results: MDXResult[] = [];
  let current = 0;

  for await (const chapter of epub.getChapters()) {
    const result = await converter.convertXMLFile(chapter);
    results.push(result);
    current++;

    options?.onProgress?.(current, results.length);
  }

  return results;
}

/**
 * Create a complete reading app component
 */
export function createReadingApp(
  epub: EPub,
  options?: {
    theme?: "light" | "dark";
    fontSize?: "small" | "medium" | "large";
    enableBookmarks?: boolean;
  },
) {
  return function ReadingApp() {
    const [currentChapter, setCurrentChapter] = React.useState(0);
    const [settings, setSettings] = React.useState({
      theme: options?.theme || "light",
      fontSize: options?.fontSize || "medium",
    });

    return (
      <div
        className={`reading-app theme-${settings.theme} font-${settings.fontSize}`}
        style={{
          minHeight: "100vh",
          backgroundColor: settings.theme === "dark" ? "#1a1a1a" : "#ffffff",
          color: settings.theme === "dark" ? "#e0e0e0" : "#333333",
          fontFamily: "Georgia, serif",
          lineHeight: "1.6",
        }}
      >
        <BookReader
          epub={epub}
          currentChapterIndex={currentChapter}
          onChapterChange={setCurrentChapter}
          className="main-reader"
        />
      </div>
    );
  };
}

/**
 * Pre-process an EPub for faster rendering
 */
export async function preprocessEPub(epub: EPub): Promise<{
  metadata: any;
  chapterCount: number;
  totalImages: number;
  totalFootnotes: number;
  tableOfContents?: Array<{ title: string; index: number }>;
}> {
  const metadata = epub.getMetadata();
  const chapters: Array<{ title: string; index: number }> = [];
  let totalImages = 0;
  let totalFootnotes = 0;
  let chapterIndex = 0;

  const converter = new XMLToMDXConverter();

  for await (const chapter of epub.getChapters()) {
    const result = await converter.convertXMLFile(chapter);

    chapters.push({
      title: result.title || `Chapter ${chapterIndex + 1}`,
      index: chapterIndex,
    });

    totalImages += result.images.length;
    totalFootnotes += result.footnotes.length;
    chapterIndex++;
  }

  return {
    metadata,
    chapterCount: chapterIndex,
    totalImages,
    totalFootnotes,
    tableOfContents: chapters,
  };
}

/**
 * Export chapter as standalone MDX file
 */
export async function exportChapterAsMDX(
  xmlFile: XMLFile,
  options?: {
    includeMetadata?: boolean;
    wrapInProvider?: boolean;
  },
): Promise<string> {
  const converter = new XMLToMDXConverter();
  const result = await converter.convertXMLFile(xmlFile);

  let mdxContent = "";

  // Add metadata as frontmatter
  if (options?.includeMetadata && result.title) {
    mdxContent += "---\n";
    mdxContent += `title: "${result.title}"\n`;
    if (result.images.length > 0) {
      mdxContent += `images: ${JSON.stringify(result.images)}\n`;
    }
    if (result.footnotes.length > 0) {
      mdxContent += `footnotes: ${JSON.stringify(result.footnotes)}\n`;
    }
    mdxContent += "---\n\n";
  }

  // Add imports if wrapping in provider
  if (options?.wrapInProvider) {
    mdxContent +=
      'import { EPubResolverProvider, Image, Footnote } from "./MDXComponents";\n\n';
    mdxContent += "export const components = { Image, Footnote };\n\n";
  }

  // Add the converted content
  mdxContent += result.content;

  return mdxContent;
}

// Example usage in a Next.js or React app
export function ExampleUsage() {
  const [epub, setEpub] = React.useState<EPub | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const epubInstance = await EPub.fromZip(arrayBuffer);
      setEpub(epubInstance);
    } catch (error) {
      console.error("Failed to load EPUB:", error);
      alert("Failed to load EPUB file");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div>Loading EPUB...</div>;
  }

  if (!epub) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <h2>EPUB Reader</h2>
        <p>Upload an EPUB file to start reading</p>
        <input
          type="file"
          accept=".epub"
          onChange={handleFileUpload}
          style={{
            padding: "1rem",
            border: "2px dashed #ccc",
            borderRadius: "8px",
            cursor: "pointer",
          }}
        />
      </div>
    );
  }

  // Use the utility to create a reading app
  const ReadingApp = EPubMDXUtils.createReadingApp(epub, {
    theme: "light",
    fontSize: "medium",
  });

  return <ReadingApp />;
}

// CSS styles that should be included in your app
export const epubReaderStyles = `
.epub-chapter {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
  line-height: 1.8;
}

.epub-chapter h1,
.epub-chapter h2,
.epub-chapter h3,
.epub-chapter h4,
.epub-chapter h5,
.epub-chapter h6 {
  margin-top: 2rem;
  margin-bottom: 1rem;
  line-height: 1.3;
}

.epub-chapter p {
  margin-bottom: 1rem;
  text-align: justify;
}

.epub-chapter img {
  max-width: 100%;
  height: auto;
  margin: 1rem 0;
  border-radius: 4px;
}

.footnote-link {
  position: relative;
  transition: all 0.2s ease;
}

.footnote-link:hover {
  background-color: rgba(0, 102, 204, 0.2) !important;
}

.reading-app.theme-dark {
  background-color: #1a1a1a;
  color: #e0e0e0;
}

.reading-app.theme-dark .epub-chapter {
  color: #e0e0e0;
}

.reading-app.font-small {
  font-size: 14px;
}

.reading-app.font-medium {
  font-size: 16px;
}

.reading-app.font-large {
  font-size: 18px;
}

.chapter-navigation button:hover:not(:disabled) {
  background-color: #0052a3;
  transform: translateY(-1px);
}

.chapter-navigation button:active:not(:disabled) {
  transform: translateY(0);
}

@media (max-width: 768px) {
  .epub-chapter {
    padding: 1rem;
  }
  
  .chapter-navigation {
    flex-direction: column;
    gap: 1rem;
  }
  
  .chapter-navigation button {
    width: 100%;
  }
}
`;
