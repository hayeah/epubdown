import { observer } from "mobx-react-lite";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PdfReaderStore } from "../stores/PdfReaderStore";

interface PdfViewerProps {
  store: PdfReaderStore;
}

export const PdfViewer = observer(({ store }: PdfViewerProps) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const [renderedPages, setRenderedPages] = useState<Set<number>>(new Set());
  const [visiblePages, setVisiblePages] = useState<Set<number>>(new Set());
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [pageInputValue, setPageInputValue] = useState("");

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
        const viewport = page.getViewport({ scale: store.zoom });
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

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

    // Setup intersection observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
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
        rootMargin: "100px", // Start loading 100px before page is visible
        threshold: 0.01,
      },
    );

    // Observe all pages
    pageRefs.current.forEach((pageDiv) => {
      observerRef.current?.observe(pageDiv);
    });

    return () => {
      observerRef.current?.disconnect();
    };
  }, [store.pdf, store.pageCount]);

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

  // Update current page based on visible pages
  useEffect(() => {
    if (visiblePages.size === 0) return;

    // Find the topmost visible page
    const sortedPages = Array.from(visiblePages).sort((a, b) => a - b);
    const currentPage = sortedPages[0];

    if (currentPage && currentPage !== store.currentPage) {
      store.setCurrentPage(currentPage);
    }
  }, [visiblePages, store]);

  // Scroll to page when currentPage changes programmatically
  const scrollToPage = useCallback((pageNum: number) => {
    const pageDiv = pageRefs.current.get(pageNum);
    if (pageDiv) {
      pageDiv.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  // Apply URL params on mount and scroll to page
  useEffect(() => {
    store.updateFromUrl(new URL(window.location.href));
    // Scroll to the page from URL after PDF loads
    if (store.pdf && store.currentPage > 1) {
      setTimeout(() => {
        scrollToPage(store.currentPage);
      }, 100); // Small delay to ensure DOM is ready
    }
  }, [store.pdf, scrollToPage]);

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
        const pageNum = parseInt(pageInputValue, 10);
        if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= store.pageCount) {
          store.setCurrentPage(pageNum);
          scrollToPage(pageNum);
          setPageInputValue("");
        }
      } else if (e.key === "Escape") {
        setPageInputValue("");
        (e.target as HTMLInputElement).blur();
      }
    },
    [pageInputValue, store.pageCount, scrollToPage, store],
  );

  const handlePageInputBlur = useCallback(() => {
    setPageInputValue("");
  }, []);

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
            Page{" "}
            {pageInputValue === "" ? (
              <button
                type="button"
                onClick={() => setPageInputValue(String(store.currentPage))}
                className="text-blue-600 hover:underline min-w-[2ch] text-center"
                title="Click to jump to page"
              >
                {store.currentPage}
              </button>
            ) : (
              <input
                type="number"
                value={pageInputValue}
                onChange={handlePageInputChange}
                onKeyDown={handlePageInputKeyDown}
                onBlur={handlePageInputBlur}
                className="w-12 px-1 border border-gray-300 rounded text-center"
                min="1"
                max={store.pageCount}
                autoFocus
              />
            )}
            {" of "}
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
