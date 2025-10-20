/**
 * Toolbar - zoom controls and page navigation
 */

import { useState } from "react";

interface ToolbarProps {
  currentPage: number;
  pageCount: number;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomFit: () => void;
  onPageChange: (page: number) => void;
}

export function Toolbar({
  currentPage,
  pageCount,
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomFit,
  onPageChange,
}: ToolbarProps) {
  const [pageInput, setPageInput] = useState(String(currentPage));

  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPageInput(e.target.value);
  };

  const handlePageInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const page = Number.parseInt(pageInput, 10);
    if (!Number.isNaN(page) && page >= 1 && page <= pageCount) {
      onPageChange(page);
    } else {
      setPageInput(String(currentPage));
    }
  };

  // Update input when current page changes externally
  if (
    pageInput !== String(currentPage) &&
    document.activeElement?.tagName !== "INPUT"
  ) {
    setPageInput(String(currentPage));
  }

  return (
    <div className="toolbar sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold">PDF Viewer</h1>
      </div>

      <div className="flex items-center gap-4">
        {/* Page navigation */}
        <form
          onSubmit={handlePageInputSubmit}
          className="flex items-center gap-2"
        >
          <span className="text-sm text-gray-600">Page</span>
          <input
            type="text"
            value={pageInput}
            onChange={handlePageInputChange}
            className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-sm"
          />
          <span className="text-sm text-gray-600">/ {pageCount}</span>
        </form>

        {/* Zoom controls */}
        <div className="flex items-center gap-2 border-l pl-4 border-gray-200">
          <button
            type="button"
            onClick={onZoomOut}
            className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors"
            title="Zoom Out"
          >
            −
          </button>
          <button
            type="button"
            onClick={onZoomFit}
            className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors"
            title="Fit Width"
          >
            Fit
          </button>
          <button
            type="button"
            onClick={onZoomIn}
            className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors"
            title="Zoom In"
          >
            +
          </button>
          <span className="text-sm text-gray-600 min-w-[4rem] text-center">
            {Math.round(zoom * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
}
