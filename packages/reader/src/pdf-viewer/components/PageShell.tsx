/**
 * PageShell - positioned placeholder for a single page
 */

import { useEffect, useRef } from "react";
import type { PageSize } from "../types";
import type { VirtualizationManager } from "../VirtualizationManager";

interface PageShellProps {
  pageIndex: number;
  size: PageSize;
  position: { top: number; height: number };
  cssZoom: number;
  virtualization: VirtualizationManager | null;
}

export function PageShell({
  pageIndex,
  size,
  position,
  cssZoom,
  virtualization,
}: PageShellProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Register with virtualization observer
  useEffect(() => {
    const shell = shellRef.current;
    if (!shell || !virtualization) return;

    virtualization.observe(shell);

    return () => {
      virtualization.unobserve(shell);
    };
  }, [virtualization]);

  const width = size.widthPt * cssZoom;
  const height = size.heightPt * cssZoom;

  return (
    <div
      ref={shellRef}
      data-page-index={pageIndex}
      className="page-shell absolute"
      style={{
        top: `${position.top}px`,
        left: "50%",
        transform: "translateX(-50%)",
        width: `${width}px`,
        height: `${height}px`,
        backgroundColor: "white",
        boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
        marginBottom: "16px",
      }}
    >
      {/* Placeholder */}
      <div className="page-placeholder absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
        Page {pageIndex + 1}
      </div>

      {/* Canvas (will be populated by render queue) */}
      <canvas
        ref={canvasRef}
        className="page-canvas absolute inset-0"
        style={{
          transformOrigin: "top left",
          transform: `scale(${cssZoom})`,
          willChange: "transform",
          display: "none",
        }}
      />
    </div>
  );
}
