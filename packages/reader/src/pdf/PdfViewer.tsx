import { observer } from "mobx-react-lite";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PdfReaderStore } from "../stores/PdfReaderStore";
import { NarrowIntersectionObserver } from "../utils/NarrowIntersectionObserver";

interface PdfViewerProps {
  store: PdfReaderStore;
}

export const PdfViewer = observer(({ store }: PdfViewerProps) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const [renderedPages, setRenderedPages] = useState<Set<number>>(new Set());
  const [visiblePages, setVisiblePages] = useState<Set<number>>(new Set());
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const narrowObserverRef = useRef<NarrowIntersectionObserver | null>(null);
  const loadingObserverRef = useRef<IntersectionObserver | null>(null);
  const [pageInputValue, setPageInputValue] = useState<string>("");
  const [isInputFocused, setIsInputFocused] = useState(false);
  const initialScrollDone = useRef(false);
  const [debugMode, setDebugMode] = useState(false);

  // Track container width and compute initial zoom
  useEffect(() => {
    const container = hostRef.current?.parentElement;
    if (!container) return;

    const updateWidth = () => {
      store.setContainerWidth(container.clientWidth);
    };

    updateWidth();
    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(container);

    return () => observer.disconnect();
  }, [store]);

  // Render a single page
  const renderPage = useCallback(
    async (pageNum: number) => {
      if (!store.pdf || renderedPages.has(pageNum)) return;

      const pageDiv = pageRefs.current.get(pageNum);
      if (!pageDiv) return;

      const canvas = pageDiv.querySelector("canvas");
      if (!canvas) return;

      try {
        setRenderedPages((prev) => new Set(prev).add(pageNum));

        const page = await store.pdf.getPage(pageNum);

        // Get device pixel ratio for high-DPI displays
        const devicePixelRatio = window.devicePixelRatio || 1;

        // Create viewport with zoom scale
        const viewport = page.getViewport({
          scale: store.zoom * devicePixelRatio,
        });
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Set actual canvas size with device pixel ratio
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        // Set display size (CSS pixels)
        canvas.style.width = `${viewport.width / devicePixelRatio}px`;
        canvas.style.height = `${viewport.height / devicePixelRatio}px`;

        await page.render({ canvasContext: ctx, viewport }).promise;

        // Hide the loading indicator after render
        const loadingDiv = pageDiv.querySelector(".absolute") as HTMLElement;
        if (loadingDiv) {
          loadingDiv.style.display = "none";
        }
      } catch (err) {
        console.error(`Failed to render page ${pageNum}:`, err);
        setRenderedPages((prev) => {
          const next = new Set(prev);
          next.delete(pageNum);
          return next;
        });
      }
    },
    [store.pdf, store.zoom, renderedPages],
  );

  // Setup page placeholders and intersection observer
  useEffect(() => {
    const host = hostRef.current;
    if (!host || !store.pdf || store.pageCount === 0) return;

    // Clear previous content
    host.innerHTML = "";
    pageRefs.current.clear();
    setRenderedPages(new Set());
    setVisiblePages(new Set());

    // Create placeholder for each page
    for (let i = 1; i <= store.pageCount; i++) {
      const pageDiv = document.createElement("div");
      pageDiv.className =
        "pdf-page mb-4 flex justify-center items-center bg-white shadow-sm relative";
      pageDiv.dataset.pageNumber = String(i);
      pageDiv.style.minHeight = "1000px"; // Default height for better initial layout

      const canvas = document.createElement("canvas");
      pageDiv.appendChild(canvas);

      // Add loading indicator
      const loadingDiv = document.createElement("div");
      loadingDiv.className = "absolute text-gray-400";
      loadingDiv.textContent = `Page ${i}`;
      pageDiv.appendChild(loadingDiv);

      host.appendChild(pageDiv);
      pageRefs.current.set(i, pageDiv);
    }

    // Setup narrow intersection observer for accurate page tracking
    if (narrowObserverRef.current) {
      narrowObserverRef.current.disconnect();
    }

    narrowObserverRef.current = new NarrowIntersectionObserver({
      topPosition: 0.1, // 10% from top for better PDF reading accuracy
      onIntersect: (entry) => {
        const pageNum = parseInt(
          (entry.target as HTMLElement).dataset.pageNumber || "0",
        );
        if (pageNum > 0 && pageNum !== store.currentPage) {
          store.setCurrentPage(pageNum);
          // Update input value if not focused
          if (!isInputFocused) {
            setPageInputValue(String(pageNum));
          }
        }
      },
      debug: debugMode,
    });

    // Setup a separate observer for lazy loading with wider margins
    if (loadingObserverRef.current) {
      loadingObserverRef.current.disconnect();
    }

    loadingObserverRef.current = new IntersectionObserver(
      (entries) => {
        const newVisiblePages = new Set<number>();

        entries.forEach((entry) => {
          const pageNum = parseInt(
            (entry.target as HTMLElement).dataset.pageNumber || "0",
          );
          if (entry.isIntersecting) {
            newVisiblePages.add(pageNum);
          }
        });

        setVisiblePages(newVisiblePages);
      },
      {
        root: null,
        rootMargin: "200px", // Start loading 200px before page is visible
        threshold: 0,
      },
    );

    // Observe all pages with both observers
    pageRefs.current.forEach((pageDiv) => {
      narrowObserverRef.current?.observe(pageDiv); // For accurate page tracking
      loadingObserverRef.current?.observe(pageDiv); // For lazy loading
    });

    // Get page from URL and scroll to it after creating page placeholders
    const urlParams = new URLSearchParams(window.location.search);
    const pageFromUrl = parseInt(urlParams.get("page") || "1", 10);
    if (
      pageFromUrl > 1 &&
      pageFromUrl <= store.pageCount &&
      !initialScrollDone.current
    ) {
      const pageDiv = pageRefs.current.get(pageFromUrl);
      if (pageDiv) {
        // Use requestAnimationFrame to ensure DOM is ready
        requestAnimationFrame(() => {
          // Use the narrow observer's scroll method for precise positioning
          if (narrowObserverRef.current) {
            narrowObserverRef.current.scrollToElement(pageDiv);
          } else {
            pageDiv.scrollIntoView({ behavior: "instant", block: "start" });
          }
          // Set the current page immediately to prevent drift
          store.setCurrentPage(pageFromUrl);
          // Delay setting the flag to allow scroll to complete
          setTimeout(() => {
            initialScrollDone.current = true;
          }, 100);
        });
      }
    } else if (!initialScrollDone.current) {
      // Even if page is 1, mark initial scroll as done
      initialScrollDone.current = true;
    }

    return () => {
      narrowObserverRef.current?.disconnect();
      loadingObserverRef.current?.disconnect();
    };
  }, [store.pdf, store.pageCount, isInputFocused, debugMode]);

  // Render visible pages
  useEffect(() => {
    visiblePages.forEach((pageNum) => {
      renderPage(pageNum);
    });
  }, [visiblePages, renderPage]);

  // Handle zoom changes - clear rendered pages to force re-render
  useEffect(() => {
    if (store.zoom > 0) {
      setRenderedPages(new Set());
      // Remove canvas content but keep placeholders
      pageRefs.current.forEach((pageDiv) => {
        const canvas = pageDiv.querySelector("canvas");
        if (canvas) {
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
          }
          canvas.width = 0;
          canvas.height = 0;
        }
        // Hide loading text when re-rendering
        const loadingDiv = pageDiv.querySelector(".absolute") as HTMLElement;
        if (loadingDiv) {
          loadingDiv.style.display = "none";
        }
      });
    }
  }, [store.zoom]);

  // The narrow observer now handles current page updates directly,
  // so we don't need this effect for page tracking.
  // visiblePages is only used for lazy loading now.

  // Sync input value with store when not focused
  useEffect(() => {
    if (!isInputFocused) {
      setPageInputValue(String(store.currentPage));
    }
  }, [store.currentPage, isInputFocused]);

  // Scroll to page when currentPage changes programmatically
  const scrollToPage = useCallback((pageNum: number) => {
    const pageDiv = pageRefs.current.get(pageNum);
    if (pageDiv) {
      if (narrowObserverRef.current) {
        narrowObserverRef.current.scrollToElement(pageDiv);
      } else {
        pageDiv.scrollIntoView({ behavior: "instant", block: "start" });
      }
    }
  }, []);

  // Apply URL params on mount
  useEffect(() => {
    store.updateFromUrl(new URL(window.location.href));
  }, [store]);

  // Add global debug toggle function
  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).togglePdfIntersectionDebug = () => {
        setDebugMode((prev) => {
          const newMode = !prev;
          console.log(`PDF intersection debug mode: ${newMode ? "ON" : "OFF"}`);
          if (narrowObserverRef.current) {
            narrowObserverRef.current.setDebugMode(newMode);
          }
          return newMode;
        });
      };
    }
    return () => {
      if (typeof window !== "undefined") {
        delete (window as any).togglePdfIntersectionDebug;
      }
    };
  }, []);

  // Zoom controls
  const handleZoomIn = () => {
    store.setZoom(store.zoom * 1.2);
  };

  const handleZoomOut = () => {
    store.setZoom(store.zoom / 1.2);
  };

  const handleZoomReset = async () => {
    await store.computeInitialZoom();
  };

  // Handle page input
  const handlePageInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setPageInputValue(e.target.value);
    },
    [],
  );

  const handlePageInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        const value = pageInputValue.trim();

        if (value === "") {
          // Reset to current page
          setPageInputValue(String(store.currentPage));
          (e.target as HTMLInputElement).blur();
          return;
        }

        let targetPage: number;

        // Handle relative navigation
        if (value.startsWith("+")) {
          const delta = parseInt(value.substring(1), 10);
          if (!isNaN(delta)) {
            targetPage = store.currentPage + delta;
          } else {
            // Invalid input, reset
            setPageInputValue(String(store.currentPage));
            (e.target as HTMLInputElement).blur();
            return;
          }
        } else if (value.startsWith("-")) {
          const delta = parseInt(value.substring(1), 10);
          if (!isNaN(delta)) {
            targetPage = store.currentPage - delta;
          } else {
            // Invalid input, reset
            setPageInputValue(String(store.currentPage));
            (e.target as HTMLInputElement).blur();
            return;
          }
        } else {
          // Absolute page number
          targetPage = parseInt(value, 10);
          if (isNaN(targetPage)) {
            // Invalid input, reset
            setPageInputValue(String(store.currentPage));
            (e.target as HTMLInputElement).blur();
            return;
          }
        }

        // Clamp to valid range
        targetPage = Math.max(1, Math.min(store.pageCount, targetPage));

        store.setCurrentPage(targetPage);
        scrollToPage(targetPage);
        setPageInputValue(String(targetPage));
        (e.target as HTMLInputElement).blur();
      } else if (e.key === "Escape") {
        // Reset to current page
        setPageInputValue(String(store.currentPage));
        (e.target as HTMLInputElement).blur();
      }
    },
    [pageInputValue, store, scrollToPage],
  );

  const handlePageInputFocus = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      setIsInputFocused(true);
      // Select all text on focus
      e.target.select();
    },
    [],
  );

  const handlePageInputBlur = useCallback(() => {
    setIsInputFocused(false);
    // Reset to current page if input is invalid
    const value = pageInputValue.trim();
    if (
      value === "" ||
      (value !== String(store.currentPage) &&
        !value.startsWith("+") &&
        !value.startsWith("-") &&
        isNaN(parseInt(value, 10)))
    ) {
      setPageInputValue(String(store.currentPage));
    }
  }, [pageInputValue, store.currentPage]);

  if (store.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading PDF...</div>
      </div>
    );
  }

  if (store.error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-500">Error: {store.error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Zoom controls */}
      <div className="fixed top-4 right-4 z-10 bg-white rounded-lg shadow-md p-2 flex gap-2">
        <button
          type="button"
          onClick={handleZoomOut}
          className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors"
          title="Zoom Out"
        >
          −
        </button>
        <button
          type="button"
          onClick={handleZoomReset}
          className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors"
          title="Fit Width"
        >
          Fit
        </button>
        <button
          type="button"
          onClick={handleZoomIn}
          className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors"
          title="Zoom In"
        >
          +
        </button>
        <span className="px-2 py-1 text-sm text-gray-600">
          {store.zoom > 0 ? Math.round(store.zoom * 100) : 100}%
        </span>
      </div>

      {/* Page indicator with input */}
      {store.pageCount > 0 && (
        <div className="fixed bottom-4 right-4 z-10 bg-white rounded-lg shadow-md px-3 py-2">
          <span className="text-sm text-gray-600 flex items-center gap-1">
            <input
              type="text"
              value={pageInputValue}
              onChange={handlePageInputChange}
              onKeyDown={handlePageInputKeyDown}
              onFocus={handlePageInputFocus}
              onBlur={handlePageInputBlur}
              className="w-16 px-1 border border-gray-300 rounded text-center"
              placeholder={String(store.currentPage)}
            />
            {" / "}
            {store.pageCount}
          </span>
        </div>
      )}

      {/* PDF container */}
      <div className="mx-auto max-w-[1200px] px-4 py-8">
        <div ref={hostRef} />
      </div>
    </div>
  );
});

export default PdfViewer;
