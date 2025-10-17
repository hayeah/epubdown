import { ContentToMarkdown, type DOMFile, type EPub } from "@epubdown/core";
import { ArrowRight } from "lucide-react";
import { observer } from "mobx-react-lite";
import React, { useEffect, useRef } from "react";
import { BookHtmlView } from "./BookHtmlView";
import { inlineChapterHTML } from "../lib/inlineHtmlAssets";
import { AsyncView } from "../lib/AsyncView";
import { markdownToReact } from "../markdownToReact";
import { useReadingProgress } from "../stores/ReadingProgressStore";
import type { ReaderStore } from "../stores/ReaderStore";
import { useReaderStore } from "../stores/RootStore";

// Helper component for HTML mode rendering
const HtmlModeRender: React.FC<{
  epub: EPub;
  chapter: DOMFile;
  onNavigate: (path: string) => void;
}> = ({ epub, chapter, onNavigate }) => {
  return <BookHtmlView epub={epub} chapter={chapter} onNavigate={onNavigate} />;
};

// Helper component for Markdown mode rendering
const MarkdownModeRender: React.FC<{
  chapter: DOMFile;
}> = ({ chapter }) => {
  return (
    <AsyncView
      loader={
        <div className="text-center p-8 text-gray-500">Loading chapter...</div>
      }
    >
      {async ({ signal }) => {
        const converter = ContentToMarkdown.create({
          basePath: chapter.base,
        });
        const markdown = await converter.convertXMLFile(chapter);
        return await markdownToReact(markdown);
      }}
    </AsyncView>
  );
};

// Chapter content component that renders the chapter
export interface ChapterContentProps {
  className?: string;
}

export const ChapterContent: React.FC<ChapterContentProps> = observer(
  ({ className }) => {
    const readerStore = useReaderStore();
    const readingProgress = useReadingProgress();
    const contentRef = useRef<HTMLDivElement>(null);

    const { currentChapter, currentChapterIndex, chapters, epub, useHtmlMode } =
      readerStore;
    const hasNextChapter = currentChapterIndex < chapters.length - 1;

    // Render content based on mode
    let reactTree: React.ReactNode = null;
    if (currentChapter) {
      if (useHtmlMode && epub) {
        reactTree = (
          <HtmlModeRender
            epub={epub}
            chapter={currentChapter}
            onNavigate={(p) => readerStore.handleTocChapterSelect(p)}
          />
        );
      } else {
        reactTree = <MarkdownModeRender chapter={currentChapter} />;
      }
    }

    // Set up IntersectionObserver for reading position tracking
    useEffect(() => {
      if (!reactTree || !contentRef.current) return;

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
    }, [reactTree, readingProgress]);

    const handleContinueReading = () => {
      if (hasNextChapter) {
        readerStore.handleChapterChange(currentChapterIndex + 1);
      }
    };

    if (!reactTree) {
      return (
        <div className="text-center p-8 text-gray-500">Loading chapter...</div>
      );
    }

    return (
      <article className={`epub-chapter ${className ?? ""}`}>
        <div className="chapter-content" ref={contentRef}>
          {reactTree}
        </div>

        {/* Continue Reading Link */}
        {hasNextChapter && (
          <div className="flex justify-end mt-12 mb-8">
            <button
              type="button"
              onClick={handleContinueReading}
              className="group flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-full bg-white hover:bg-gray-50 transition-all duration-300 ease-out hover:shadow-md"
            >
              <span>Continue reading</span>
              <ArrowRight
                size={16}
                className="transition-transform duration-300 group-hover:translate-x-1"
              />
            </button>
          </div>
        )}
      </article>
    );
  },
);
