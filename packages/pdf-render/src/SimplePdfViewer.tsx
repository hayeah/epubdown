import { useEffect, useRef, useState } from "react";
import { DEFAULT_PDFIUM_WASM_URL } from "@embedpdf/pdfium";
import {
  createPdfiumEngine,
  createPdfjsEngine,
  type DocumentHandle,
  type PDFEngine,
  type RendererKind,
} from "./engines";

interface SimplePdfViewerProps {
  pdfData: Uint8Array;
  engineKind?: RendererKind;
  defaultPpi?: number;
  wasmUrl?: string;
  className?: string;
  onPageChange?: (page: number) => void;
}

interface PageState {
  index0: number;
  canvas: HTMLCanvasElement | null;
  width: number;
  height: number;
  rendered: boolean;
}

export function SimplePdfViewer({
  pdfData,
  engineKind = "PDFium",
  defaultPpi = 144,
  wasmUrl = DEFAULT_PDFIUM_WASM_URL,
  className = "",
  onPageChange,
}: SimplePdfViewerProps) {
  const [engine, setEngine] = useState<PDFEngine | null>(null);
  const [doc, setDoc] = useState<DocumentHandle | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [pages, setPages] = useState<PageState[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [ppi, setPpi] = useState(defaultPpi);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());

  // Initialize engine and load document
  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        setIsLoading(true);
        setError(null);

        const newEngine =
          engineKind === "PDFium" ? createPdfiumEngine() : createPdfjsEngine();

        const initOptions = engineKind === "PDFium" ? { wasmUrl } : undefined;
        await newEngine.init(initOptions);

        if (!mounted) return;

        const newDoc = await newEngine.loadDocument(pdfData);

        if (!mounted) {
          newDoc.destroy();
          return;
        }

        const count = newDoc.pageCount();
        setEngine(newEngine);
        setDoc(newDoc);
        setPageCount(count);

        // Initialize page states
        const initialPages: PageState[] = Array.from(
          { length: count },
          (_, i) => ({
            index0: i,
            canvas: null,
            width: 0,
            height: 0,
            rendered: false,
          }),
        );
        setPages(initialPages);

        setIsLoading(false);
      } catch (err) {
        if (!mounted) return;
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setIsLoading(false);
      }
    }

    init();

    return () => {
      mounted = false;
      doc?.destroy();
      canvasRefs.current.clear();
    };
  }, [pdfData, engineKind, wasmUrl]);

  // Render visible pages
  useEffect(() => {
    if (!doc || pages.length === 0) return;

    let mounted = true;

    async function renderPages() {
      // Render pages around current page (2 before, 2 after)
      const startPage = Math.max(0, currentPage - 2);
      const endPage = Math.min(pageCount - 1, currentPage + 2);

      // Collect all page updates to batch them
      const updates = new Map<number, Partial<PageState>>();

      for (let i = startPage; i <= endPage; i++) {
        if (!mounted || !doc) return;

        const page = pages[i];
        if (!page || page.rendered) continue;

        try {
          const canvas = canvasRefs.current.get(i);
          if (!canvas) continue;

          let width = page.width;
          let height = page.height;

          // Get page size if not already known
          if (width === 0) {
            const size = await doc.getPageSize(i);
            const scale = ppi / 72;
            width = Math.floor(size.wPt * scale);
            height = Math.floor(size.hPt * scale);
          }

          // Render page
          const pageHandle = await doc.loadPage(i);
          await pageHandle.renderToCanvas(canvas, ppi);
          pageHandle.destroy();

          // Collect the update for this page
          updates.set(i, { width, height, canvas, rendered: true });
        } catch (err) {
          console.error(`Failed to render page ${i}:`, err);
        }
      }

      // Batch update all pages at once
      if (updates.size > 0 && mounted) {
        setPages((prev) => {
          const next = [...prev];
          for (const [index, update] of updates) {
            if (next[index]) {
              next[index] = { ...next[index], ...update };
            }
          }
          return next;
        });
      }
    }

    renderPages();

    return () => {
      mounted = false;
    };
  }, [doc, currentPage, ppi, pageCount]);

  // Notify parent of page changes
  useEffect(() => {
    onPageChange?.(currentPage);
  }, [currentPage, onPageChange]);

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(pageCount, prev + 1));
  };

  const handleZoomIn = () => {
    setPpi((prev) => Math.min(288, prev + 24));
    // Reset dimensions and rendered state to force recomputation
    setPages((prev) =>
      prev.map((p) => ({ ...p, width: 0, height: 0, rendered: false })),
    );
  };

  const handleZoomOut = () => {
    setPpi((prev) => Math.max(72, prev - 24));
    // Reset dimensions and rendered state to force recomputation
    setPages((prev) =>
      prev.map((p) => ({ ...p, width: 0, height: 0, rendered: false })),
    );
  };

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <p>Loading PDF...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <p className="text-red-500">Error: {error}</p>
      </div>
    );
  }

  if (!doc || pageCount === 0) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <p>No pages to display</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-4 p-4 border-b bg-gray-50">
        <button
          type="button"
          onClick={handlePrevPage}
          disabled={currentPage === 1}
          className="px-3 py-1 border rounded disabled:opacity-50"
        >
          Previous
        </button>
        <span>
          Page {currentPage} / {pageCount}
        </span>
        <button
          type="button"
          onClick={handleNextPage}
          disabled={currentPage === pageCount}
          className="px-3 py-1 border rounded disabled:opacity-50"
        >
          Next
        </button>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={handleZoomOut}
            className="px-3 py-1 border rounded"
          >
            −
          </button>
          <span>{Math.round((ppi / 72) * 100)}%</span>
          <button
            type="button"
            onClick={handleZoomIn}
            className="px-3 py-1 border rounded"
          >
            +
          </button>
        </div>

        <select
          value={engineKind}
          onChange={(e) => {
            // Engine switching would require reloading, which we'll skip for simplicity
            console.log("Engine switching not implemented in simple viewer");
          }}
          className="px-2 py-1 border rounded"
        >
          <option value="PDFium">PDFium</option>
          <option value="PDFJS">PDF.js</option>
        </select>
      </div>

      {/* PDF Pages */}
      <div ref={containerRef} className="flex-1 overflow-auto bg-gray-100">
        <div className="flex flex-col items-center gap-4 p-4">
          {pages.map((page) => {
            const isCurrentPage = page.index0 === currentPage - 1;
            const hasSize = page.width > 0 && page.height > 0;
            return (
              <div
                key={page.index0}
                className={`bg-white shadow-lg ${
                  isCurrentPage ? "ring-2 ring-blue-500" : ""
                }`}
                style={
                  hasSize
                    ? {
                        width: page.width,
                        height: page.height,
                      }
                    : {
                        width: 600,
                        aspectRatio: "8.5 / 11",
                        minHeight: 100,
                      }
                }
              >
                <canvas
                  ref={(el) => {
                    if (el) {
                      canvasRefs.current.set(page.index0, el);
                    } else {
                      canvasRefs.current.delete(page.index0);
                    }
                  }}
                  style={{
                    width: "100%",
                    height: "100%",
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
