import { observer } from "mobx-react-lite";
import { reaction } from "mobx";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PdfReaderStore } from "../stores/PdfReaderStore";
import { makeVisibilityTracker } from "./VisibilityWindow";
import { ZOOM_PPI_LEVELS, ppiForFitWidth } from "./pdfConstants";

interface PdfViewerProps {
  store: PdfReaderStore;
}

export const PdfViewer = observer(({ store }: PdfViewerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const canvasHostRefs = useRef<(HTMLDivElement | null)[]>([]);
  const trackerRef = useRef<ReturnType<typeof makeVisibilityTracker> | null>(
    null,
  );
  const currentPageObserverRef = useRef<IntersectionObserver | null>(null);

  // Force re-render on DPR changes (fix #2)
  const [dprTick, setDprTick] = useState(0);

  // Compute DPR each render instead of memoizing (fix #2)
  const devicePixelRatio =
    typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

  const zoomModeRef = useRef<"manual" | "fit">("manual");
  const pendingScrollRestore = useRef<{
    pageIndex: number;
    position: number;
  } | null>(null);

  // Calculate current position within the current page (0.0 = top, 1.0 = bottom)
  const calculateCurrentPosition = useCallback((): number => {
    if (!containerRef.current) return 0;

    const index0 = store.currentPageIndex;
    const slot = slotRefs.current[index0];
    if (!slot) return 0;

    const containerRect = containerRef.current.getBoundingClientRect();
    const slotRect = slot.getBoundingClientRect();

    // Calculate offset within page
    const pageTopOffset = slotRect.top - containerRect.top;
    const offsetWithinPage = -pageTopOffset;
    const slotHeight = slotRect.height;

    // Return as ratio, clamped to [0, 1]
    return slotHeight > 0
      ? Math.max(0, Math.min(1, offsetWithinPage / slotHeight))
      : 0;
  }, [store.currentPageIndex]);

  // Restore scroll position based on page and position percentage
  const restoreScrollPosition = (pageIndex: number, position: number) => {
    const slot = slotRefs.current[pageIndex];
    if (!slot || !containerRef.current) return;

    // Scroll page to top first
    slot.scrollIntoView({ behavior: "auto", block: "start" });

    // Then adjust by position percentage
    requestAnimationFrame(() => {
      if (!containerRef.current || !slot) return;
      const slotRect = slot.getBoundingClientRect();
      const offset = slotRect.height * position;
      containerRef.current.scrollTop += offset;
    });
  };

  const fitCurrentWidth = useCallback(() => {
    if (!containerRef.current) return;
    const index0 = Math.max(0, store.currentPage - 1);
    const page = store.pages[index0];
    if (!page) return;

    const cssWidth = containerRef.current.clientWidth;
    if (!cssWidth || cssWidth <= 0) return;

    const ppiFit = ppiForFitWidth(
      cssWidth,
      window.devicePixelRatio || 1,
      page,
      store.ppi,
    );

    if (ppiFit && ppiFit !== store.ppi) {
      const position = calculateCurrentPosition();
      const pageIndex = store.currentPageIndex;
      pendingScrollRestore.current = { pageIndex, position };
      store.setPpi(ppiFit);
    }
  }, [store, calculateCurrentPosition]);

  useEffect(() => {
    slotRefs.current.length = store.pageCount;
    canvasHostRefs.current.length = store.pageCount;
  }, [store.pageCount]);

  // ResizeObserver for container size changes in fit mode (fix #4)
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(() => {
      if (zoomModeRef.current === "fit") {
        fitCurrentWidth();
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [fitCurrentWidth]);

  // Keyboard shortcuts for zoom and navigation
  useEffect(() => {
    if (!containerRef.current) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle shortcuts if not in an input/textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key) {
        case "+":
        case "=": {
          // Zoom in
          e.preventDefault();
          zoomModeRef.current = "manual";
          let currentZoomIndex = ZOOM_PPI_LEVELS.indexOf(store.ppi);
          if (currentZoomIndex === -1) {
            currentZoomIndex = ZOOM_PPI_LEVELS.findIndex(
              (ppi) => ppi > store.ppi,
            );
            if (currentZoomIndex === -1)
              currentZoomIndex = ZOOM_PPI_LEVELS.length - 1;
            else currentZoomIndex--;
          }
          const newIndex = Math.min(
            ZOOM_PPI_LEVELS.length - 1,
            currentZoomIndex + 1,
          );
          const newPpi = ZOOM_PPI_LEVELS[newIndex];
          if (newPpi && newPpi !== store.ppi) {
            const position = calculateCurrentPosition();
            const pageIndex = store.currentPageIndex;
            pendingScrollRestore.current = { pageIndex, position };
            store.setPpi(newPpi);
          }
          break;
        }
        case "-":
        case "_": {
          // Zoom out
          e.preventDefault();
          zoomModeRef.current = "manual";
          let currentZoomIndex = ZOOM_PPI_LEVELS.indexOf(store.ppi);
          if (currentZoomIndex === -1) {
            currentZoomIndex = ZOOM_PPI_LEVELS.findIndex(
              (ppi) => ppi >= store.ppi,
            );
            if (currentZoomIndex === -1)
              currentZoomIndex = ZOOM_PPI_LEVELS.length;
          }
          const newIndex = Math.max(0, currentZoomIndex - 1);
          const newPpi = ZOOM_PPI_LEVELS[newIndex];
          if (newPpi && newPpi !== store.ppi) {
            const position = calculateCurrentPosition();
            const pageIndex = store.currentPageIndex;
            pendingScrollRestore.current = { pageIndex, position };
            store.setPpi(newPpi);
          }
          break;
        }
        case "0": {
          // Reset to 100%
          e.preventDefault();
          zoomModeRef.current = "manual";
          if (store.ppi !== 96) {
            const position = calculateCurrentPosition();
            const pageIndex = store.currentPageIndex;
            pendingScrollRestore.current = { pageIndex, position };
            store.setPpi(96);
          }
          break;
        }
        case "f":
        case "F": {
          // Fit to width
          e.preventDefault();
          zoomModeRef.current = "fit";
          fitCurrentWidth();
          break;
        }
        case "PageUp": {
          // Previous page
          e.preventDefault();
          const prevPage = Math.max(1, store.currentPage - 1);
          if (prevPage !== store.currentPage) {
            store.setCurrentPage(prevPage);
            const slot = slotRefs.current[prevPage - 1];
            if (slot && containerRef.current) {
              slot.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          }
          break;
        }
        case "PageDown": {
          // Next page
          e.preventDefault();
          const nextPage = Math.min(store.pageCount, store.currentPage + 1);
          if (nextPage !== store.currentPage) {
            store.setCurrentPage(nextPage);
            const slot = slotRefs.current[nextPage - 1];
            if (slot && containerRef.current) {
              slot.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          }
          break;
        }
      }
    };

    const container = containerRef.current;
    container.addEventListener("keydown", handleKeyDown);
    // Make container focusable to receive keyboard events
    if (!container.hasAttribute("tabindex")) {
      container.setAttribute("tabindex", "0");
    }

    return () => {
      container.removeEventListener("keydown", handleKeyDown);
    };
  }, [store, calculateCurrentPosition, fitCurrentWidth]);

  useEffect(() => {
    if (!containerRef.current) return;

    const tracker = makeVisibilityTracker((visible) => {
      store.onPagesVisible(visible);
    });
    trackerRef.current = tracker;

    // Track intersection ratios for all pages
    const pageRatios = new Map<number, number>();

    // Observer for current page tracking
    // Page with highest visibility becomes the current page
    const currentPageObserver = new IntersectionObserver(
      (entries) => {
        // Update ratios map with changed entries
        for (const entry of entries) {
          const index = Number((entry.target as HTMLElement).dataset.index);
          if (!Number.isNaN(index)) {
            if (entry.isIntersecting && entry.intersectionRatio > 0) {
              pageRatios.set(index, entry.intersectionRatio);
            } else {
              pageRatios.delete(index);
            }
          }
        }

        // Find the page with the highest visibility
        let maxRatio = 0;
        let maxIndex = -1;

        for (const [index, ratio] of pageRatios.entries()) {
          if (ratio > maxRatio) {
            maxRatio = ratio;
            maxIndex = index;
          }
        }

        // Update current page to the most visible page
        if (maxIndex >= 0) {
          const newPage = maxIndex + 1;
          if (newPage !== store.currentPage) {
            store.setCurrentPage(newPage);
          }
        }
      },
      {
        root: containerRef.current,
        threshold: [0, 0.1, 0.25, 0.5, 0.75, 1.0],
      },
    );
    currentPageObserverRef.current = currentPageObserver;

    // Observe existing slots
    for (const el of slotRefs.current) {
      if (el) {
        tracker.observe(el);
        currentPageObserver.observe(el);
      }
    }

    return () => {
      if (trackerRef.current === tracker) {
        trackerRef.current = null;
      }
      if (currentPageObserverRef.current === currentPageObserver) {
        currentPageObserverRef.current = null;
      }
      store.onPagesVisible([]);
      tracker.disconnect();
      currentPageObserver.disconnect();
    };
  }, [store]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!containerRef.current) return;
    if (store.pageCount === 0) return;

    const container = containerRef.current;
    let rafIdForFit: number | null = null;
    const prevDprRef = { current: window.devicePixelRatio || 1 };

    // Update position immediately on scroll (no RAF delay)
    const updatePosition = () => {
      const position = calculateCurrentPosition();
      store.setPosition(position);
    };

    // Throttle position updates to ~10/s (fix #5)
    let lastWriteTime = 0;
    const throttledUpdatePosition = () => {
      const now = performance.now();
      if (now - lastWriteTime > 100) {
        updatePosition();
        lastWriteTime = now;
      }
    };

    // Notify store about scroll/layout changes (triggers render scheduling)
    const onScrollEvent = () => {
      store.onScroll();
      // Update URL with throttling to reduce noise
      throttledUpdatePosition();
    };

    // Handle resize and DPR changes with RAF for fit mode
    const onResizeOrDpr = () => {
      if (rafIdForFit !== null) return;
      rafIdForFit = window.requestAnimationFrame(() => {
        rafIdForFit = null;
        const nowDpr = window.devicePixelRatio || 1;
        const dprChanged = Math.abs(nowDpr - prevDprRef.current) > 0.001;
        if (dprChanged) {
          prevDprRef.current = nowDpr;
          // Force React re-render on DPR changes (fix #2)
          setDprTick((t) => t + 1);
        }
        if (zoomModeRef.current === "fit" && containerRef.current) {
          fitCurrentWidth();
        }
        // Update position after potential fit changes
        updatePosition();
      });
    };

    // Listen to scroll on the actual container, not window
    container.addEventListener("scroll", onScrollEvent, { passive: true });
    window.addEventListener("resize", onResizeOrDpr, { passive: true });

    // Some browsers won't emit resize on DPR changes; listen to MQ as a backup
    const mq = window.matchMedia(
      `(resolution: ${window.devicePixelRatio}dppx)`,
    );
    const mqListener = () => onResizeOrDpr();
    if (mq?.addEventListener) mq.addEventListener("change", mqListener);
    else if ((mq as any)?.addListener) (mq as any).addListener(mqListener);

    // Trigger initial position update
    updatePosition();

    return () => {
      if (rafIdForFit !== null) {
        window.cancelAnimationFrame(rafIdForFit);
        rafIdForFit = null;
      }
      container.removeEventListener("scroll", onScrollEvent);
      window.removeEventListener("resize", onResizeOrDpr);
      if (mq?.removeEventListener) mq.removeEventListener("change", mqListener);
      else if ((mq as any)?.removeListener)
        (mq as any).removeListener(mqListener);
    };
  }, [store, calculateCurrentPosition, store.pageCount]);

  // Handle initial page load and URL restoration
  const hasRestoredRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (store.pageCount === 0) return;
    if (hasRestoredRef.current) return;

    const url = new URL(window.location.href);
    const targetPage = Number(url.searchParams.get("page") ?? 1);
    const targetPosition = Number(url.searchParams.get("position") ?? 0);
    const targetPpi = Number(url.searchParams.get("ppi") ?? 0);

    // Apply PPI first if specified
    if (targetPpi > 0 && targetPpi !== store.ppi) {
      store.setPpi(targetPpi);
    }

    // Wait for page dimensions to be loaded before restoring scroll
    if (store.dimensionRevision > 0) {
      hasRestoredRef.current = true;

      if (targetPage > 0 && targetPage <= store.pageCount) {
        // Set the current page first
        store.setCurrentPage(targetPage);

        // Then restore scroll position
        setTimeout(() => {
          restoreScrollPosition(targetPage - 1, targetPosition);
        }, 150);
      }
    }
  }, [store, store.pageCount, store.dimensionRevision]);

  // Handle pending scroll restoration after dimension changes
  useEffect(() => {
    if (pendingScrollRestore.current && store.dimensionRevision > 0) {
      const { pageIndex, position } = pendingScrollRestore.current;
      pendingScrollRestore.current = null;
      setTimeout(() => restoreScrollPosition(pageIndex, position), 100);
    }
  }, [store.dimensionRevision]);

  useEffect(() => {
    // Local cache to diff canvases by index
    const lastByIndex = new Map<number, HTMLCanvasElement | null>();

    const dispose = reaction(
      () => store.pages.map((p) => [p.index0, p.canvas] as const),
      (pairs) => {
        for (const [index, canvas] of pairs) {
          const prev = lastByIndex.get(index) ?? null;
          if (prev === canvas) continue; // no change → skip work

          lastByIndex.set(index, canvas ?? null);
          const host = canvasHostRefs.current[index];
          if (!host) continue;

          // Remove any old DOM only when needed
          const existing = host.querySelector("canvas");
          if (existing && existing !== canvas) {
            existing.parentElement?.removeChild(existing);
          }

          if (canvas && existing !== canvas) {
            // Style once before mount
            canvas.style.maxWidth = "100%";
            canvas.style.height = "auto";
            canvas.style.display = "block";
            host.appendChild(canvas);
          }
        }
      },
      { fireImmediately: true },
    );

    return dispose;
  }, [store]);

  // Calculate maximum page width to size container
  const maxPageWidth = useMemo(() => {
    return store.pages.reduce((max, page) => {
      if (!page.wPx) return max;
      const cssWidth = Math.floor(page.wPx / devicePixelRatio);
      return Math.max(max, cssWidth);
    }, 0);
    // Depend only on wPx values and DPR; map to a stable array of numbers to avoid reruns on unrelated page changes
  }, [devicePixelRatio, store.pages.map((p) => p.wPx).join(",")]);

  if (store.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Loading PDF…
      </div>
    );
  }

  if (store.error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-500">
        Error: {store.error}
      </div>
    );
  }

  const pageCount = store.pageCount;

  // Container width adapts to content but never exceeds viewport
  const containerMaxWidth =
    maxPageWidth > 0
      ? `min(${maxPageWidth + 32}px, 100vw - 2rem)`
      : "min(100vw - 2rem, 1200px)";

  return (
    <div
      ref={containerRef}
      className="h-screen bg-gray-100 relative overflow-auto"
    >
      {/* Page indicator */}
      {pageCount > 0 && (
        <div className="fixed bottom-4 right-4 z-10 bg-white rounded-lg shadow px-3 py-2 text-sm text-gray-600">
          Page {store.currentPage} of {pageCount}
        </div>
      )}

      {/* Zoom controls */}
      {pageCount > 0 && (
        <div className="fixed bottom-4 left-4 z-10 bg-white rounded-lg shadow px-2 py-2 flex items-center gap-2">
          <button
            onClick={() => {
              zoomModeRef.current = "manual";
              let currentZoomIndex = ZOOM_PPI_LEVELS.indexOf(store.ppi);
              // If current PPI is not in the array (e.g., from Fit mode), find the nearest lower level
              if (currentZoomIndex === -1) {
                currentZoomIndex = ZOOM_PPI_LEVELS.findIndex(
                  (ppi) => ppi >= store.ppi,
                );
                if (currentZoomIndex === -1)
                  currentZoomIndex = ZOOM_PPI_LEVELS.length;
              }
              const newIndex = Math.max(0, currentZoomIndex - 1);
              const newPpi = ZOOM_PPI_LEVELS[newIndex];
              if (newPpi && newPpi !== store.ppi) {
                const position = calculateCurrentPosition();
                const pageIndex = store.currentPageIndex;
                pendingScrollRestore.current = { pageIndex, position };
                store.setPpi(newPpi);
              }
            }}
            disabled={(() => {
              let i = ZOOM_PPI_LEVELS.indexOf(store.ppi);
              // If not in array, check if we can still zoom out
              if (i === -1) {
                return store.ppi <= (ZOOM_PPI_LEVELS[0] ?? 72);
              }
              return i <= 0;
            })()}
            className="px-3 py-1 rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
          >
            −
          </button>

          <span className="text-sm text-gray-600 min-w-[60px] text-center">
            {Math.round((store.ppi / 96) * 100)}%
          </span>

          <button
            onClick={() => {
              zoomModeRef.current = "manual";
              let currentZoomIndex = ZOOM_PPI_LEVELS.indexOf(store.ppi);
              // If current PPI is not in the array (e.g., from Fit mode), find the nearest higher level
              if (currentZoomIndex === -1) {
                currentZoomIndex = ZOOM_PPI_LEVELS.findIndex(
                  (ppi) => ppi > store.ppi,
                );
                if (currentZoomIndex === -1)
                  currentZoomIndex = ZOOM_PPI_LEVELS.length - 1;
                else currentZoomIndex--;
              }
              const newIndex = Math.min(
                ZOOM_PPI_LEVELS.length - 1,
                currentZoomIndex + 1,
              );
              const newPpi = ZOOM_PPI_LEVELS[newIndex];
              if (newPpi && newPpi !== store.ppi) {
                const position = calculateCurrentPosition();
                const pageIndex = store.currentPageIndex;
                pendingScrollRestore.current = { pageIndex, position };
                store.setPpi(newPpi);
              }
            }}
            disabled={(() => {
              let i = ZOOM_PPI_LEVELS.indexOf(store.ppi);
              // If not in array, check if we can still zoom in
              if (i === -1) {
                return (
                  store.ppi >=
                  (ZOOM_PPI_LEVELS[ZOOM_PPI_LEVELS.length - 1] ?? 192)
                );
              }
              return i >= ZOOM_PPI_LEVELS.length - 1;
            })()}
            className="px-3 py-1 rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
          >
            +
          </button>

          <button
            onClick={() => {
              zoomModeRef.current = "fit";
              fitCurrentWidth();
            }}
            className="ml-1 px-2 py-1 rounded text-xs font-medium hover:bg-gray-100"
            title="Fit page width to container"
          >
            Fit
          </button>

          <button
            onClick={() => {
              zoomModeRef.current = "manual";
              if (store.ppi !== 96) {
                const position = calculateCurrentPosition();
                const pageIndex = store.currentPageIndex;
                pendingScrollRestore.current = { pageIndex, position };
                store.setPpi(96);
              }
            }}
            className="px-2 py-1 rounded text-xs font-medium hover:bg-gray-100"
            title="Reset to 100%"
          >
            100%
          </button>
        </div>
      )}

      <div
        className="pdf-scroll-container mx-auto px-4 py-8"
        style={{ maxWidth: containerMaxWidth }}
      >
        {Array.from({ length: pageCount }).map((_, index0) => {
          // Access dimensionRevision to trigger re-render when dimensions change
          const _dimensionRevision = store.dimensionRevision;
          const { width, height } = store.getPageLayout(index0);
          const cssWidth = Math.max(1, Math.floor(width / devicePixelRatio));
          const cssHeight = Math.max(1, Math.floor(height / devicePixelRatio));
          const hasCanvas = Boolean(store.pages[index0]?.canvas);
          const pageKey = store.pages[index0]?.index0 ?? index0;
          const isVisible = store.visibleSet.has(index0);

          return (
            <div
              key={`page-${pageKey}`}
              data-index={index0}
              className="pdf-page-slot mb-4 flex justify-center items-start"
              style={{
                minHeight: cssHeight,
                position: "relative",
              }}
              ref={(el) => {
                const prev = slotRefs.current[index0];
                if (prev) {
                  if (trackerRef.current) {
                    trackerRef.current.unobserve(prev);
                  }
                  if (currentPageObserverRef.current) {
                    currentPageObserverRef.current.unobserve(prev);
                  }
                }
                slotRefs.current[index0] = el;
                if (el) {
                  if (trackerRef.current) {
                    trackerRef.current.observe(el);
                  }
                  if (currentPageObserverRef.current) {
                    currentPageObserverRef.current.observe(el);
                  }
                }
              }}
            >
              {/* Page number label */}
              <div className="absolute top-2 left-2 z-20 px-2 py-1 rounded text-xs font-mono bg-gray-800 text-white">
                {index0 + 1}
              </div>

              {isVisible ? (
                <div
                  ref={(el) => {
                    canvasHostRefs.current[index0] = el;

                    // Fix #1: ensure existing canvas gets mounted even if reaction doesn't fire
                    if (el) {
                      const canvas = store.pages[index0]?.canvas ?? null;
                      if (canvas && !el.contains(canvas)) {
                        canvas.style.maxWidth = "100%";
                        canvas.style.height = "auto";
                        canvas.style.display = "block";
                        el.appendChild(canvas);
                      }
                    }
                  }}
                  className="relative bg-white shadow-sm"
                  style={{
                    width: cssWidth,
                    height: cssHeight,
                    maxWidth: "100%",
                  }}
                >
                  {!hasCanvas && (
                    <div
                      className="absolute inset-0 flex items-center justify-center"
                      style={{
                        background: "#f5f5f5",
                        border: "1px solid #ddd",
                      }}
                    >
                      <span className="text-gray-400 text-sm">Loading...</span>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  ref={() => {
                    // Clear the host ref when not visible
                    canvasHostRefs.current[index0] = null;
                  }}
                  style={{
                    width: cssWidth,
                    height: cssHeight,
                    maxWidth: "100%",
                  }}
                  className="bg-white shadow-sm"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default PdfViewer;
