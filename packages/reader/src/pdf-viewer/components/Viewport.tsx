/**
 * Viewport component - manages scroll container and page layout
 */

import { forwardRef, useEffect, useRef } from "react";
import type { PageSize } from "../types";
import type { VirtualizationManager } from "../VirtualizationManager";
import { PageShell } from "./PageShell";

interface ViewportProps {
  pageCount: number;
  getPageSize: (i: number) => PageSize;
  cssZoom: number;
  virtualization: VirtualizationManager | null;
  onPageChange: (page: number) => void;
}

export const Viewport = forwardRef<HTMLDivElement, ViewportProps>(
  ({ pageCount, getPageSize, cssZoom, virtualization, onPageChange }, ref) => {
    const pagesContainerRef = useRef<HTMLDivElement>(null);

    // Initialize virtualization observer
    useEffect(() => {
      if (!virtualization || !ref || typeof ref === "function") return;

      const container = ref.current;
      if (!container) return;

      virtualization.init(container, "200px");

      return () => {
        virtualization.dispose();
      };
    }, [virtualization, ref]);

    // Track current page based on scroll position
    useEffect(() => {
      if (!ref || typeof ref === "function") return;
      const container = ref.current;
      if (!container) return;

      let rafId: number;
      let lastPage = 1;

      const handleScroll = () => {
        rafId = requestAnimationFrame(() => {
          const scrollTop = container.scrollTop;
          const viewportHeight = container.clientHeight;
          const viewportCenter = scrollTop + viewportHeight * 0.3;

          // Find page at viewport center
          let cumulativeHeight = 0;
          for (let i = 0; i < pageCount; i++) {
            const size = getPageSize(i);
            const pageHeight = size.heightPt * cssZoom;
            cumulativeHeight += pageHeight + 16; // Add margin

            if (cumulativeHeight > viewportCenter) {
              const newPage = i + 1;
              if (newPage !== lastPage) {
                lastPage = newPage;
                onPageChange(newPage);
              }
              break;
            }
          }
        });
      };

      container.addEventListener("scroll", handleScroll, { passive: true });

      return () => {
        container.removeEventListener("scroll", handleScroll);
        cancelAnimationFrame(rafId);
      };
    }, [pageCount, getPageSize, cssZoom, onPageChange, ref]);

    // Calculate cumulative positions
    const pagePositions: { top: number; height: number }[] = [];
    let cumulativeTop = 0;
    for (let i = 0; i < pageCount; i++) {
      const size = getPageSize(i);
      const height = size.heightPt * cssZoom;
      pagePositions.push({ top: cumulativeTop, height });
      cumulativeTop += height + 16; // Add margin
    }

    return (
      <div
        ref={ref}
        className="viewport flex-1 overflow-auto"
        style={{
          contain: "content",
          willChange: "scroll-position",
          backgroundColor: "#f3f4f6",
        }}
      >
        <div
          ref={pagesContainerRef}
          className="pages-container relative"
          style={{
            height: `${cumulativeTop}px`,
            margin: "0 auto",
            maxWidth: cssZoom < 1.4 ? "1200px" : "none",
          }}
        >
          {Array.from({ length: pageCount }, (_, i) => (
            <PageShell
              key={i}
              pageIndex={i}
              size={getPageSize(i)}
              position={pagePositions[i]!}
              cssZoom={cssZoom}
              virtualization={virtualization}
            />
          ))}
        </div>
      </div>
    );
  },
);

Viewport.displayName = "Viewport";
