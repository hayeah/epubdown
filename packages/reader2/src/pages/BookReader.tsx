import { ContentToMarkdown } from "@epubdown/core";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { ChevronLeft, ChevronRight, List, Library, X, Settings, Type } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { observer } from "mobx-react-lite";
import { ASCIIMatrixStream } from "../components/ASCIIMatrixStream/ASCIIMatrixStream";
import { useIsMobile } from "../hooks/use-mobile";
import { markdownToReact } from "../markdown/markdownToReact";
import { useReaderStore } from "../stores/RootStore";
import type React from "react";

const __DOC__ = `
# BookReader

Page for reading epub chapter content.

## window.__agent

- store — ReaderStore (MobX observable)
  - store.currentChapterIndex (number)
  - store.currentBookId (number | null)
  - store.isSidebarOpen (boolean)
  - store.metadata — book metadata object
  - store.navItems — flat nav items from TOC
- nextChapter() — go to next chapter
- previousChapter() — go to previous chapter
- setChapter(index) — jump to chapter by index
- toggleSidebar() — toggle TOC sidebar
- $topAnchor — top-of-chapter scroll anchor
- $scrollContainer — the scrollable reading area
`;

// --- Scramble text hook ---

const GLITCH_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789§¶†‡※ΩΣΨΔΦλπξ";

function useScrambleText(text: string, scrambled: boolean, duration = 250) {
  const [display, setDisplay] = useState(text);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const chars = text.split("");
    const startTime = performance.now();
    const tick = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const revealFraction = scrambled ? 1 - progress : progress;
      const result = chars.map((ch, i) => {
        if (ch === " ") return " ";
        const threshold = i / chars.length;
        if (revealFraction > threshold) return ch;
        return GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
      });
      setDisplay(result.join(""));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [text, scrambled, duration]);

  return display;
}

function ScrambleText({
  text,
  scrambled,
  className,
  onClick,
}: {
  text: string;
  scrambled: boolean;
  className?: string;
  onClick?: () => void;
}) {
  const display = useScrambleText(text, scrambled);
  return (
    <button onClick={onClick} className={className}>
      <span className="font-mono">{display}</span>
    </button>
  );
}

// --- Chapter content renderer ---

const ChapterContent: React.FC = observer(() => {
  const readerStore = useReaderStore();
  const [content, setContent] = useState<React.ReactNode>(null);
  const [loading, setLoading] = useState(true);
  const chapter = readerStore.currentChapter;
  const chapterIndex = readerStore.currentChapterIndex;

  useEffect(() => {
    if (!chapter) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      const converter = ContentToMarkdown.create({ basePath: chapter.base });
      const markdown = await converter.convertXMLFile(chapter);
      const reactContent = await markdownToReact(markdown);
      if (!cancelled) {
        setContent(reactContent);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [chapter, chapterIndex]);

  if (loading) {
    return <div className="text-center py-16 text-gray-400">Loading chapter...</div>;
  }

  return <>{content}</>;
});

// --- Chapter navigation ---

function ChapterNav({ compact }: { compact?: boolean }) {
  const store = useReaderStore();
  const { currentChapterIndex: idx } = store;

  // Find previous/next nav item labels
  const prevLabel =
    idx > 0
      ? store.navItems.find((item) => {
          const ci = store.findChapterIndexByPath(item.path);
          return ci === idx - 1;
        })?.label || `Chapter ${idx}`
      : null;

  const nextLabel = store.hasNextChapter
    ? store.navItems.find((item) => {
        const ci = store.findChapterIndexByPath(item.path);
        return ci === idx + 1;
      })?.label || `Chapter ${idx + 2}`
    : null;

  return (
    <nav
      className={`max-w-[36rem] mx-auto flex items-center justify-between ${compact ? "px-4 py-2" : "px-8 py-3"}`}
    >
      {store.hasPreviousChapter ? (
        <button
          onClick={() => store.handleChapterChange(idx - 1)}
          className="group flex items-center gap-2"
        >
          <ChevronLeft
            size={14}
            className="text-gray-300 group-hover:text-orange-500 group-hover:-translate-x-0.5 transition-all"
          />
          <div className="text-left">
            <p className="text-[9px] uppercase tracking-[0.2em] text-gray-300 mb-0.5">Previous</p>
            <p
              className={`text-gray-400 group-hover:text-orange-600 transition-colors ${compact ? "text-xs" : "text-sm"}`}
            >
              {prevLabel}
            </p>
          </div>
        </button>
      ) : (
        <div />
      )}

      {store.hasNextChapter ? (
        <button
          onClick={() => store.handleChapterChange(idx + 1)}
          className="group flex items-center gap-2"
        >
          <div className="text-right">
            <p className="text-[9px] uppercase tracking-[0.2em] text-gray-300 mb-0.5">Next</p>
            <p
              className={`text-gray-400 group-hover:text-orange-600 transition-colors ${compact ? "text-xs" : "text-sm"}`}
            >
              {nextLabel}
            </p>
          </div>
          <ChevronRight
            size={14}
            className="text-gray-300 group-hover:text-orange-500 group-hover:translate-x-0.5 transition-all"
          />
        </button>
      ) : (
        <div />
      )}
    </nav>
  );
}

// --- Component ---

export const BookReader = observer(() => {
  const isMobile = useIsMobile();
  const readerStore = useReaderStore();
  const params = useParams<{ bookId: string; chapterIndex?: string }>();
  const [, navigate] = useLocation();
  const topRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [tocSheetOpen, setTocSheetOpen] = useState(false);

  const bookId = params.bookId ? Number(params.bookId) : null;
  const chapterIndex = params.chapterIndex !== undefined ? Number(params.chapterIndex) : undefined;

  // Wire navigate
  useEffect(() => {
    readerStore.setNavigate(navigate);
  }, [readerStore, navigate]);

  // Load book
  useEffect(() => {
    if (!bookId) return;
    setError(null);
    readerStore.loadBookAndChapter(bookId, chapterIndex).catch((err) => {
      setError(err.message);
    });
  }, [readerStore, bookId, chapterIndex]);

  // Scroll to top on chapter change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0 });
    } else {
      window.scrollTo(0, 0);
    }
  }, [readerStore.currentChapterIndex]);

  // Register __agent
  useEffect(() => {
    (window as any).__agent = {
      store: readerStore,
      nextChapter: () => readerStore.handleChapterChange(readerStore.currentChapterIndex + 1),
      previousChapter: () => readerStore.handleChapterChange(readerStore.currentChapterIndex - 1),
      setChapter: (index: number) => readerStore.handleChapterChange(index),
      toggleSidebar: () => readerStore.toggleSidebar(),
      get $topAnchor() {
        return topRef.current;
      },
      get $scrollContainer() {
        return scrollRef.current;
      },
    };
    return () => {
      (window as any).__agent = null;
    };
  });

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Link href="/" className="text-orange-600 hover:underline">
            Back to library
          </Link>
        </div>
      </div>
    );
  }

  if (!readerStore.epub) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-gray-400">Loading book...</p>
      </div>
    );
  }

  const { metadata, currentChapterTitle, currentChapterIndex: chapIdx } = readerStore;
  const bookTitle = metadata.title || "Unknown Book";
  const bookAuthor = metadata.creator || metadata.author || "";

  // Build fortunes for the ASCII matrix header
  const titleLines = bookTitle.toUpperCase().split(/\s+/).filter(Boolean);
  const fortuneLines: any[] = [...titleLines];
  if (bookAuthor) {
    fortuneLines.push("");
    fortuneLines.push({ text: bookAuthor.toUpperCase(), color: "rgba(120,113,108,0.6)" });
  }

  const readingContent = (
    <article className={isMobile ? "px-3" : "max-w-[36rem] mx-auto px-8"}>
      <header className="mb-14">
        <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-orange-500/60 mb-3">
          {currentChapterTitle ? `Chapter ${chapIdx + 1}` : ""}
        </p>
        <h1 className="text-2xl font-light text-gray-800 tracking-tight">
          {currentChapterTitle || `Chapter ${chapIdx + 1}`}
        </h1>
        <div className="mt-5 w-8 h-px bg-gray-200" />
      </header>

      <div
        className="space-y-7 text-[16.5px] leading-[1.85] text-gray-600"
        style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
      >
        <ChapterContent />
      </div>

      <div className="mt-16 flex justify-center">
        <span className="text-gray-200 text-xs tracking-[0.5em] font-mono">···</span>
      </div>

      <div className="mt-10 pb-12">
        <ChapterNav compact={isMobile} />
      </div>
    </article>
  );

  const tocList = (
    <div className="space-y-1">
      {readerStore.navItems.map((item, i) => {
        const itemChapterIdx = readerStore.findChapterIndexByPath(item.path);
        return (
          <button
            key={`${item.path}-${i}`}
            onClick={() => {
              readerStore.handleTocChapterSelect(item.path);
              setTocSheetOpen(false);
              readerStore.setSidebarOpen(false);
            }}
            className={`block w-full text-left px-4 py-2.5 text-sm transition-colors ${
              itemChapterIdx === chapIdx
                ? "text-orange-600 font-medium bg-orange-50"
                : "text-gray-500 active:bg-gray-50"
            }`}
            style={{ paddingLeft: `${1 + item.level * 1}rem` }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );

  // --- MOBILE LAYOUT ---
  if (isMobile) {
    return (
      <div className="flex flex-col h-screen w-full bg-white text-[#1A1A1A] selection:bg-orange-100 overflow-hidden">
        <div className="flex-shrink-0 bg-white border-b border-gray-100 z-20">
          <div className="flex items-center justify-between px-3 h-11">
            <Link
              href="/"
              className="flex items-center justify-center w-9 h-9 text-gray-400 active:bg-gray-100 transition-colors"
            >
              <Library size={18} />
            </Link>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setTocSheetOpen(true)}
                className="flex items-center justify-center w-9 h-9 text-gray-400 active:bg-gray-100 transition-colors"
              >
                <List size={18} />
              </button>
              <button className="flex items-center justify-center w-9 h-9 text-gray-400 active:bg-gray-100 transition-colors">
                <Type size={18} />
              </button>
              <button className="flex items-center justify-center w-9 h-9 text-gray-400 active:bg-gray-100 transition-colors">
                <Settings size={18} />
              </button>
            </div>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div ref={topRef} className="w-full h-28 overflow-hidden relative">
            <ASCIIMatrixStream fortunes={[fortuneLines]} staticTime={8000} />
          </div>
          <ChapterNav compact />
          <div className="pt-8">{readingContent}</div>
        </div>

        <AnimatePresence>
          {tocSheetOpen && (
            <>
              <motion.div
                className="fixed inset-0 bg-black/30 z-30"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setTocSheetOpen(false)}
              />
              <motion.div
                className="fixed bottom-0 left-0 right-0 z-40 bg-white rounded-t-2xl max-h-[70vh] flex flex-col"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 28, stiffness: 300 }}
              >
                <div className="flex justify-center pt-3 pb-1">
                  <div className="w-10 h-1 rounded-full bg-gray-300" />
                </div>
                <div className="flex items-center justify-between px-4 pb-2">
                  <span className="text-sm font-semibold text-gray-800">Contents</span>
                  <button
                    onClick={() => setTocSheetOpen(false)}
                    className="p-1.5 text-gray-400 active:text-gray-600 rounded-full"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="overflow-y-auto pb-8">{tocList}</div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // --- DESKTOP LAYOUT ---
  return (
    <div ref={scrollRef} className="h-screen bg-white overflow-y-auto">
      <div className="mx-auto selection:bg-orange-100">
        <div ref={topRef} className="relative h-40 max-w-4xl mx-auto overflow-hidden">
          <ASCIIMatrixStream fortunes={[fortuneLines]} staticTime={8000} />
        </div>

        <ChapterNav />

        <div className="relative pt-12 pb-24">
          <div className="fixed right-[calc(50%+18rem)] top-[17rem]">
            <div className="w-52 text-right pr-4">
              <div className="flex flex-col items-end gap-3 mb-5">
                <Link
                  href="/"
                  className="group inline-flex items-center gap-2 text-gray-300 hover:text-orange-500 transition-colors"
                >
                  <span className="text-[11px] uppercase tracking-[0.15em] opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    Library
                  </span>
                  <Library size={18} />
                </Link>
                <button
                  onClick={() => readerStore.toggleSidebar()}
                  className="group inline-flex items-center gap-2 text-gray-300 hover:text-gray-500 transition-colors"
                  title="Toggle contents"
                >
                  <span className="text-[11px] uppercase tracking-[0.15em] opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    Contents
                  </span>
                  <List size={18} />
                </button>
              </div>

              <div
                className={`transition-opacity duration-300 ease-out ${readerStore.isSidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
              >
                {readerStore.navItems.map((item, i) => {
                  const itemChapterIdx = readerStore.findChapterIndexByPath(item.path);
                  return (
                    <ScrambleText
                      key={`${item.path}-${i}`}
                      text={item.label}
                      scrambled={!readerStore.isSidebarOpen}
                      onClick={() => readerStore.handleTocChapterSelect(item.path)}
                      className={`block w-full text-right py-1.5 text-[13px] transition-colors ${
                        itemChapterIdx === chapIdx
                          ? "text-orange-600"
                          : "text-gray-300 hover:text-gray-500"
                      }`}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {readingContent}
        </div>
      </div>
    </div>
  );
});
