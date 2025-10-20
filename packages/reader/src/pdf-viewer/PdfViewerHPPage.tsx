/**
 * Demo page for high-performance PDF viewer
 * Includes feature flag toggles and performance monitoring
 */

import { useState, useCallback, useEffect } from "react";
import { useRoute } from "wouter";
import { PdfViewerHP } from "./components/PdfViewerHP";
import type { FeatureFlags, PerfSample } from "./types";
import { useBookLibraryStore } from "../stores/RootStore";

export function PdfViewerHPPage() {
  const [match, params] = useRoute("/pdf-hp/:bookId");
  const lib = useBookLibraryStore();
  const [features, setFeatures] = useState<Partial<FeatureFlags>>({
    perfHUD: true,
    tiling: false,
    textLayer: false,
    thumbs: false,
    offscreenCanvas: false,
    threadsSIMD: false,
  });
  const [perfSamples, setPerfSamples] = useState<PerfSample[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handlePerfSample = useCallback((sample: PerfSample) => {
    setPerfSamples((prev) => [...prev.slice(-50), sample]); // Keep last 50 samples
    console.log("Perf sample:", sample);
  }, []);

  const toggleFeature = (key: keyof FeatureFlags) => {
    setFeatures((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Load PDF data from library store
  useEffect(() => {
    if (!match || !params?.bookId) {
      setIsLoading(false);
      return;
    }

    const loadPdf = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const bookId = Number(params.bookId);
        const data = await lib.loadBookForReading(bookId);

        if (!data) {
          throw new Error("Book not found");
        }

        const buf = await data.blob.arrayBuffer();
        // Convert to Uint8Array (will be copied in the engine to prevent detachment)
        const uint8Array = new Uint8Array(buf);
        setPdfData(uint8Array);
        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load PDF");
        setIsLoading(false);
      }
    };

    void loadPdf();
  }, [match, params?.bookId, lib]);

  if (!match || !params?.bookId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div>
          <h2 className="text-xl font-bold mb-4">
            High-Performance PDF Viewer Demo
          </h2>
          <p className="text-gray-600">
            Navigate to /pdf-hp/:bookId to view a PDF
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-600">Loading PDF...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-red-600">Error: {error}</div>
      </div>
    );
  }

  if (!pdfData) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-600">No PDF data available</div>
      </div>
    );
  }

  return (
    <div className="relative h-screen">
      {/* Settings Panel */}
      <button
        type="button"
        onClick={() => setShowSettings(!showSettings)}
        className="fixed top-20 right-4 z-20 bg-blue-500 text-white px-3 py-2 rounded shadow-lg hover:bg-blue-600"
      >
        {showSettings ? "Hide" : "Show"} Settings
      </button>

      {showSettings && (
        <div className="fixed top-32 right-4 z-20 bg-white p-4 rounded shadow-lg border border-gray-200 min-w-[250px]">
          <h3 className="font-bold mb-3">Feature Flags</h3>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={features.perfHUD}
                onChange={() => toggleFeature("perfHUD")}
                className="rounded"
              />
              <span className="text-sm">Performance HUD</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={features.tiling}
                onChange={() => toggleFeature("tiling")}
                className="rounded"
              />
              <span className="text-sm">Tiling (1024x1024)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={features.textLayer}
                onChange={() => toggleFeature("textLayer")}
                className="rounded"
              />
              <span className="text-sm">Text Layer</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={features.thumbs}
                onChange={() => toggleFeature("thumbs")}
                className="rounded"
              />
              <span className="text-sm">Thumbnails</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={features.offscreenCanvas}
                onChange={() => toggleFeature("offscreenCanvas")}
                className="rounded"
              />
              <span className="text-sm">OffscreenCanvas</span>
            </label>
          </div>

          {perfSamples.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <h3 className="font-bold mb-2 text-sm">Latest Sample</h3>
              <div className="text-xs space-y-1 text-gray-600">
                <div>
                  Pages: {perfSamples[perfSamples.length - 1]?.pagesAlive}
                </div>
                <div>
                  FPS:{" "}
                  {perfSamples[perfSamples.length - 1]?.framesLast2s || "N/A"}
                </div>
                <div>
                  Long Tasks:{" "}
                  {perfSamples[perfSamples.length - 1]?.longTasksLast2s || 0}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Viewer */}
      <PdfViewerHP
        src={pdfData}
        engine="pdfjs"
        features={features}
        maxPagesAlive={6}
        onPerfSample={handlePerfSample}
        onReady={(meta) => {
          console.log("PDF ready:", meta);
        }}
      />
    </div>
  );
}
