/**
 * High-Performance PDF Viewer
 * Main component that orchestrates engine, virtualization, rendering, and zoom
 */

import { useEffect, useRef, useState, useCallback } from "react";
import type {
  PdfEngine,
  FeatureFlags,
  PerfSample,
  RenderScale,
} from "../types";
import { PdfJsEngine } from "../engines/PdfJsEngine";
import { CanvasPool } from "../CanvasPool";
import { VirtualizationManager } from "../VirtualizationManager";
import { RenderQueue } from "../RenderQueue";
import { ZoomManager } from "../ZoomManager";
import { PerformanceSampler } from "../PerformanceSampler";
import { RenderPriority } from "../types";
import { Viewport } from "./Viewport";
import { Toolbar } from "./Toolbar";
import { PerfHUD } from "./PerfHUD";

export interface PdfViewerHPProps {
  src: ArrayBuffer | Uint8Array | URL;
  engine?: "pdfjs" | "pdfium" | "mupdf";
  initialZoom?: number;
  maxPagesAlive?: number;
  tileSize?: number;
  features?: Partial<FeatureFlags>;
  onPerfSample?: (sample: PerfSample) => void;
  onReady?: (meta: { pageCount: number }) => void;
}

const defaultFeatures: FeatureFlags = {
  tiling: false,
  textLayer: false,
  thumbs: false,
  perfHUD: false,
  offscreenCanvas: false,
  threadsSIMD: false,
};

export function PdfViewerHP({
  src,
  engine: engineType = "pdfjs",
  initialZoom = 1.0,
  maxPagesAlive = 6,
  tileSize = 1024,
  features: userFeatures = {},
  onPerfSample,
  onReady,
}: PdfViewerHPProps) {
  const features = { ...defaultFeatures, ...userFeatures };

  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [perfSample, setPerfSample] = useState<PerfSample | null>(null);

  // Refs for managers
  const engineRef = useRef<PdfEngine | null>(null);
  const canvasPoolRef = useRef<CanvasPool | null>(null);
  const virtualizationRef = useRef<VirtualizationManager | null>(null);
  const renderQueueRef = useRef<RenderQueue | null>(null);
  const zoomManagerRef = useRef<ZoomManager | null>(null);
  const perfSamplerRef = useRef<PerformanceSampler | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const getPageSizeRef = useRef<
    ((i: number) => { widthPt: number; heightPt: number }) | null
  >(null);

  // Handle page visibility changes
  const handleVisibilityChange = useCallback(
    (pageIndex: number, visible: boolean) => {
      if (
        !renderQueueRef.current ||
        !canvasPoolRef.current ||
        !zoomManagerRef.current
      )
        return;

      if (visible) {
        // Acquire canvas and queue render
        const canvas = canvasPoolRef.current.acquire();
        const scale = zoomManagerRef.current.getScale();

        renderQueueRef.current.enqueue(
          pageIndex,
          scale,
          canvas,
          RenderPriority.Visible,
        );

        // Track in virtualization
        virtualizationRef.current?.trackRendered({
          canvas,
          rendered: true,
          timestamp: Date.now(),
          scale,
          pageIndex,
        });
      } else {
        // Release canvas
        // (simplified - in real implementation, track canvas by page index)
      }
    },
    [],
  );

  // Handle zoom changes
  const handleZoomChange = useCallback((scale: RenderScale) => {
    // Re-render all visible pages at new scale
    const visiblePages = virtualizationRef.current?.getVisiblePages() || [];

    for (const pageIndex of visiblePages) {
      if (!renderQueueRef.current || !canvasPoolRef.current) continue;

      const canvas = canvasPoolRef.current.acquire();
      renderQueueRef.current.enqueue(
        pageIndex,
        scale,
        canvas,
        RenderPriority.Visible,
      );
    }
  }, []);

  // Initialize
  useEffect(() => {
    let disposed = false;

    async function init() {
      try {
        // Create engine
        const engine =
          engineType === "pdfjs"
            ? new PdfJsEngine()
            : // Add PDFium/MuPDF engines here
              new PdfJsEngine();

        engineRef.current = engine;

        // Load document
        const { pageCount: count, getPageSize } = await engine.load(src);
        if (disposed) return;

        getPageSizeRef.current = getPageSize;
        setPageCount(count);
        setLoading(false);

        // Initialize managers
        canvasPoolRef.current = new CanvasPool();

        // Virtualization
        const virtualization = new VirtualizationManager(
          maxPagesAlive,
          handleVisibilityChange,
        );
        virtualizationRef.current = virtualization;

        // Render queue
        const renderQueue = new RenderQueue(engine, 2);
        renderQueueRef.current = renderQueue;

        // Zoom manager
        const zoomManager = new ZoomManager(handleZoomChange, 0.4);
        if (initialZoom !== 1.0) {
          zoomManager.setZoom(initialZoom);
        }
        zoomManagerRef.current = zoomManager;

        // Performance sampler
        if (features.perfHUD || onPerfSample) {
          const sampler = new PerformanceSampler(
            engine,
            engineType,
            (sample) => {
              // Add canvas pool stats
              sample.gpuEst_bytes = canvasPoolRef.current?.estimateGPUMemory();
              sample.pagesAlive =
                virtualizationRef.current?.getRenderedCount() || 0;

              setPerfSample(sample);
              onPerfSample?.(sample);
            },
          );
          sampler.start();
          perfSamplerRef.current = sampler;
        }

        onReady?.({ pageCount: count });
      } catch (err) {
        if (!disposed) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      }
    }

    init();

    return () => {
      disposed = true;
      engineRef.current?.dispose();
      canvasPoolRef.current?.dispose();
      virtualizationRef.current?.dispose();
      renderQueueRef.current?.clear();
      zoomManagerRef.current?.dispose();
      perfSamplerRef.current?.dispose();
    };
  }, [
    src,
    engineType,
    maxPagesAlive,
    initialZoom,
    onReady,
    onPerfSample,
    features.perfHUD,
    handleVisibilityChange,
    handleZoomChange,
  ]);

  // Toolbar handlers
  const handleZoomIn = () => {
    zoomManagerRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    zoomManagerRef.current?.zoomOut();
  };

  const handleZoomFit = () => {
    if (viewportRef.current && getPageSizeRef.current) {
      const containerWidth = viewportRef.current.clientWidth;
      const pageSize = getPageSizeRef.current(currentPage - 1);
      zoomManagerRef.current?.resetToFit(pageSize.widthPt, containerWidth);
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-gray-600">Loading PDF...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-red-600">Error: {error}</div>
      </div>
    );
  }

  const cssZoom = zoomManagerRef.current?.getCSSZoom() || 1.0;

  return (
    <div className="pdf-viewer-hp h-screen flex flex-col bg-gray-100">
      <Toolbar
        currentPage={currentPage}
        pageCount={pageCount}
        zoom={cssZoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomFit={handleZoomFit}
        onPageChange={handlePageChange}
      />

      <Viewport
        ref={viewportRef}
        pageCount={pageCount}
        getPageSize={getPageSizeRef.current!}
        cssZoom={cssZoom}
        virtualization={virtualizationRef.current}
        onPageChange={handlePageChange}
      />

      {features.perfHUD && perfSample && <PerfHUD sample={perfSample} />}
    </div>
  );
}
