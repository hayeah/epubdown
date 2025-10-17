import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { initRootStore } from "../lib/providers_gen";
import { type RootStore, StoreProvider } from "../stores/RootStore";
import { PdfReaderStore } from "../stores/PdfReaderStore";
import { PdfViewer } from "./PdfViewer";
// Import the PDF file as a URL
import pdfUrl from "./test.pdf?url";

// Performance thresholds (in milliseconds)
const PERF_THRESHOLDS = {
  jumpScroll: 500, // Jump scroll should complete within 500ms
  pageRenderFirst: 1000, // First page render should complete within 1s
  pageRenderSubsequent: 500, // Subsequent page renders should be faster
  scrollSmooth: 200, // Smooth scroll should feel responsive within 200ms
};

interface PerformanceMetrics {
  operation: string;
  duration: number;
  timestamp: number;
  zoom: number;
  pageCount?: number;
}

/**
 * Helper to wait for a specific number of pages to be rendered
 */
async function waitForPagesRendered(count: number, timeout = 10000) {
  await waitFor(
    () => {
      // Look for canvases that have been rendered (have width and height)
      const canvases = document.querySelectorAll(
        "canvas.pdf-page-canvas",
      ) as NodeListOf<HTMLCanvasElement>;

      const renderedCanvases = Array.from(canvases).filter((canvas) => {
        // Check if canvas has been drawn to (has dimensions and is visible)
        const hasSize = canvas.width > 0 && canvas.height > 0;
        const isVisible = canvas.style.display === "block";

        // Simply check if the canvas has dimensions and is visible
        // The PDF rendering has completed if these conditions are met
        return hasSize && isVisible;
      });

      console.log(
        `Rendered pages: ${renderedCanvases.length}/${count} (found ${canvases.length} canvases total)`,
      );

      expect(renderedCanvases.length).toBeGreaterThanOrEqual(count);
    },
    { timeout },
  );
}

/**
 * Helper to scroll to a specific page
 */
async function scrollToPage(pageNum: number): Promise<number> {
  const startTime = performance.now();

  const container = document.querySelector(".pdf-scroll-container");
  const pageContainer = document.querySelector(
    `[data-page-num="${pageNum}"]`,
  ) as HTMLElement;

  if (!container || !pageContainer) {
    throw new Error(`Page ${pageNum} or container not found`);
  }

  // Simulate jump scroll
  pageContainer.scrollIntoView({ behavior: "instant", block: "start" });

  // Wait for scroll to complete
  await new Promise((resolve) => setTimeout(resolve, 100));

  return performance.now() - startTime;
}

/**
 * Helper to measure page render time
 */
async function measurePageRenderTime(pageNum: number): Promise<number> {
  const startTime = performance.now();

  await waitFor(
    () => {
      const canvas = document.querySelector(
        `.pdf-page-canvas[data-page-num="${pageNum}"]`,
      ) as HTMLCanvasElement;
      expect(canvas).toBeTruthy();
      expect(canvas.style.display).toBe("block");
    },
    { timeout: 3000 },
  );

  return performance.now() - startTime;
}

/**
 * Helper to perform smooth scroll
 */
async function smoothScrollPages(direction: "down" | "up", pageCount: number) {
  const container = document.querySelector(
    ".pdf-scroll-container",
  ) as HTMLElement;
  if (!container) throw new Error("Container not found");

  const scrollAmount = direction === "down" ? 1000 : -1000;
  const metrics: PerformanceMetrics[] = [];

  for (let i = 0; i < pageCount; i++) {
    const startTime = performance.now();

    container.scrollTop += scrollAmount;

    // Wait for scroll to settle
    await new Promise((resolve) => setTimeout(resolve, 100));

    const duration = performance.now() - startTime;
    metrics.push({
      operation: `scroll_${direction}_${i + 1}`,
      duration,
      timestamp: Date.now(),
      zoom: 1,
    });
  }

  return metrics;
}

/**
 * Log performance metrics with warnings for slow operations
 */
function logPerformanceMetrics(
  metrics: PerformanceMetrics[],
  threshold: number,
) {
  console.log("\n=== Performance Metrics ===");

  let totalDuration = 0;
  let slowOps = 0;

  for (const metric of metrics) {
    const isSlow = metric.duration > threshold;
    if (isSlow) slowOps++;

    const status = isSlow ? "⚠️  SLOW" : "✓ OK";
    const zoomInfo = metric.zoom
      ? ` @ ${Math.round(metric.zoom * 100)}% zoom`
      : "";
    const pageInfo = metric.pageCount ? ` (${metric.pageCount} pages)` : "";

    console.log(
      `${status} ${metric.operation}${zoomInfo}${pageInfo}: ${Math.round(metric.duration)}ms`,
    );

    totalDuration += metric.duration;
  }

  const avgDuration = totalDuration / metrics.length;
  console.log(`\nAverage: ${Math.round(avgDuration)}ms`);
  console.log(`Slow operations: ${slowOps}/${metrics.length}`);
  console.log("===========================\n");

  if (slowOps > 0) {
    console.warn(
      `⚠️  Warning: ${slowOps} operation(s) exceeded the ${threshold}ms threshold`,
    );
  }

  return { avgDuration, slowOps };
}

/**
 * Helper to load a PDF file for testing
 */
async function loadPdfFile(url: string): Promise<File> {
  console.log(`Fetching PDF from: ${url}`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch PDF: ${response.status} ${response.statusText}`,
    );
  }
  const blob = await response.blob();
  console.log(`Loaded PDF, size: ${blob.size} bytes, type: ${blob.type}`);

  if (blob.size === 0) {
    throw new Error("PDF file is empty");
  }

  if (!blob.type.includes("pdf")) {
    throw new Error(
      `Invalid file type: ${blob.type} (expected application/pdf)`,
    );
  }

  return new File([blob], "test.pdf", { type: "application/pdf" });
}

describe("PdfViewer Performance Tests", () => {
  let rootStore: RootStore;
  let pdfStore: PdfReaderStore;
  let testBookId: number;
  const allMetrics: PerformanceMetrics[] = [];

  beforeEach(async () => {
    // Create test root store
    rootStore = await initRootStore({
      dbName: `test-perf-${Date.now()}`,
      blobStoreName: `test-perf-blob-${Date.now()}`,
    });

    // Load the test PDF file using the imported URL
    const pdfFile = await loadPdfFile(pdfUrl);
    testBookId = await rootStore.bookLibraryStore.addPdf(pdfFile);

    console.log("testBookId", testBookId);

    // Create PDF reader store
    pdfStore = new PdfReaderStore(
      rootStore.bookLibraryStore,
      rootStore.eventSystem,
    );

    // Load the PDF into the store
    await pdfStore.load(testBookId);

    // Wait for PDF to be fully loaded
    expect(pdfStore.pdf).toBeTruthy();
    expect(pdfStore.pageCount).toBeGreaterThan(0);
    console.log(`PDF loaded: ${pdfStore.pageCount} pages`);
    console.log("PDF object:", pdfStore.pdf);
    console.log("PDF zoom:", pdfStore.zoom);

    // Verify PDF.js worker is configured
    const pdfjs = await import("pdfjs-dist");
    console.log(
      "PDF.js worker configured:",
      !!pdfjs.GlobalWorkerOptions.workerSrc,
    );
    console.log("PDF.js worker URL:", pdfjs.GlobalWorkerOptions.workerSrc);

    // Clear metrics
    allMetrics.length = 0;
  });

  afterEach(async () => {
    if (pdfStore) {
      pdfStore.dispose();
    }
    if (rootStore) {
      try {
        await rootStore.close();
      } catch (err) {
        // Ignore close errors in tests
        console.warn("Error closing rootStore:", err);
      }
    }
  });

  describe("Core Performance Tests", () => {
    it("should measure jump scroll performance", async () => {
      const metrics: PerformanceMetrics[] = [];

      // Render the viewer
      const { container } = render(
        <StoreProvider value={rootStore}>
          <PdfViewer store={pdfStore} />
        </StoreProvider>,
      );

      console.log("Component rendered, checking DOM structure...");

      // Check if the PDF viewer container exists
      const scrollContainer = container.querySelector(".pdf-scroll-container");
      console.log("Scroll container found:", !!scrollContainer);

      const pageContainers = container.querySelectorAll(".pdf-page-container");
      console.log("Page containers found:", pageContainers.length);

      // Give the viewer time to initialize and create placeholders
      console.log("Waiting for initialization...");
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Check again after init
      const pageContainersAfter = container.querySelectorAll(
        ".pdf-page-container",
      );
      console.log("Page containers after init:", pageContainersAfter.length);

      const canvases = container.querySelectorAll("canvas.pdf-page-canvas");
      console.log("Canvases found:", canvases.length);

      // Wait for initial render - give more time after initialization
      console.log("Waiting for first page to render...");
      await new Promise((resolve) => setTimeout(resolve, 500)); // Allow render to complete
      await waitForPagesRendered(1);

      // Calculate middle page
      const middlePage = Math.floor(pdfStore.pageCount / 2);

      // Test 1: Jump to middle of book
      const jumpToMiddleTime = await scrollToPage(middlePage);
      metrics.push({
        operation: `jump_to_middle_page_${middlePage}`,
        duration: jumpToMiddleTime,
        timestamp: Date.now(),
        zoom: pdfStore.zoom,
      });

      // Wait for pages to render after jump
      const renderAfterJumpTime = await measurePageRenderTime(middlePage);
      metrics.push({
        operation: `render_after_jump_page_${middlePage}`,
        duration: renderAfterJumpTime,
        timestamp: Date.now(),
        zoom: pdfStore.zoom,
      });

      // Log and validate
      const { avgDuration, slowOps } = logPerformanceMetrics(
        metrics,
        PERF_THRESHOLDS.jumpScroll,
      );

      allMetrics.push(...metrics);

      // Assert performance
      expect(jumpToMiddleTime).toBeLessThan(PERF_THRESHOLDS.jumpScroll);
      expect(renderAfterJumpTime).toBeLessThan(PERF_THRESHOLDS.pageRenderFirst);
    }, 15000);

    it("should measure scroll down performance", async () => {
      const metrics: PerformanceMetrics[] = [];

      render(
        <StoreProvider value={rootStore}>
          <PdfViewer store={pdfStore} />
        </StoreProvider>,
      );

      // Wait for initial render
      await waitForPagesRendered(1);

      // Scroll down a few pages
      const scrollMetrics = await smoothScrollPages("down", 3);
      metrics.push(...scrollMetrics);

      // Log and validate
      const { avgDuration } = logPerformanceMetrics(
        metrics,
        PERF_THRESHOLDS.scrollSmooth,
      );

      allMetrics.push(...metrics);

      // Assert performance
      expect(avgDuration).toBeLessThan(PERF_THRESHOLDS.scrollSmooth);
    }, 15000);

    it("should measure scroll up performance", async () => {
      const metrics: PerformanceMetrics[] = [];

      render(
        <StoreProvider value={rootStore}>
          <PdfViewer store={pdfStore} />
        </StoreProvider>,
      );

      // Wait for initial render
      await waitForPagesRendered(1);

      // First scroll down to middle
      const middlePage = Math.floor(pdfStore.pageCount / 2);
      await scrollToPage(middlePage);
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Then scroll up
      const scrollMetrics = await smoothScrollPages("up", 3);
      metrics.push(...scrollMetrics);

      // Log and validate
      const { avgDuration } = logPerformanceMetrics(
        metrics,
        PERF_THRESHOLDS.scrollSmooth,
      );

      allMetrics.push(...metrics);

      // Assert performance
      expect(avgDuration).toBeLessThan(PERF_THRESHOLDS.scrollSmooth);
    }, 15000);
  });

  describe("Zoom Level Performance Tests", () => {
    const zoomLevels = [0.5, 1.0, 1.5, 2.0];

    for (const zoom of zoomLevels) {
      it(`should measure performance at ${Math.round(zoom * 100)}% zoom with scrolling`, async () => {
        const metrics: PerformanceMetrics[] = [];

        // Set the zoom level
        pdfStore.setZoom(zoom);

        render(
          <StoreProvider value={rootStore}>
            <PdfViewer store={pdfStore} />
          </StoreProvider>,
        );

        // Wait for initial render
        await waitForPagesRendered(1);

        // Calculate test page (around 1/3 of the document)
        const testPage = Math.floor(pdfStore.pageCount / 3);

        // Test jump scroll at this zoom level
        const jumpTime = await scrollToPage(testPage);
        metrics.push({
          operation: `jump_scroll_zoom_${Math.round(zoom * 100)}`,
          duration: jumpTime,
          timestamp: Date.now(),
          zoom,
        });

        // Wait for render after jump
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Test render time at this zoom level
        const renderTime = await measurePageRenderTime(testPage);
        metrics.push({
          operation: `page_render_zoom_${Math.round(zoom * 100)}`,
          duration: renderTime,
          timestamp: Date.now(),
          zoom,
        });

        // IMPORTANT: Test scrolling 5-10 pages after zoom to measure real performance
        console.log(
          `\nTesting scroll performance after zoom to ${Math.round(zoom * 100)}%...`,
        );

        // Scroll down 7 pages to test performance
        const scrollDownMetrics = await smoothScrollPages("down", 7);
        metrics.push(
          ...scrollDownMetrics.map((m, i) => ({
            ...m,
            operation: `scroll_down_page_${i + 1}_zoom_${Math.round(zoom * 100)}`,
            zoom,
          })),
        );

        // Wait a bit for renders to settle
        await new Promise((resolve) => setTimeout(resolve, 300));

        // Scroll up 5 pages
        const scrollUpMetrics = await smoothScrollPages("up", 5);
        metrics.push(
          ...scrollUpMetrics.map((m, i) => ({
            ...m,
            operation: `scroll_up_page_${i + 1}_zoom_${Math.round(zoom * 100)}`,
            zoom,
          })),
        );

        // Log and validate
        console.log(`\nZoom ${Math.round(zoom * 100)}% Performance Summary:`);
        logPerformanceMetrics(metrics, PERF_THRESHOLDS.scrollSmooth);

        allMetrics.push(...metrics);

        // Assert that zoom doesn't drastically degrade performance
        // Higher zoom should be allowed to be slower, but not excessively
        const zoomMultiplier = Math.max(1, zoom / 1.5);
        expect(jumpTime).toBeLessThan(
          PERF_THRESHOLDS.jumpScroll * zoomMultiplier,
        );

        // Check average scroll performance
        const scrollTimes = [...scrollDownMetrics, ...scrollUpMetrics].map(
          (m) => m.duration,
        );
        const avgScrollTime =
          scrollTimes.reduce((a, b) => a + b, 0) / scrollTimes.length;
        console.log(
          `Average scroll time at ${Math.round(zoom * 100)}%: ${Math.round(avgScrollTime)}ms`,
        );

        // Allow slower scrolling at higher zoom but not excessively
        expect(avgScrollTime).toBeLessThan(
          PERF_THRESHOLDS.scrollSmooth * zoomMultiplier * 1.5,
        );
      }, 30000);
    }
  });

  describe("Critical Zoom Performance Test", () => {
    it("should maintain good performance at 1.5x zoom with heavy scrolling", async () => {
      const metrics: PerformanceMetrics[] = [];
      const targetZoom = 1.5;

      console.log("\n🎯 Testing critical 1.5x zoom performance...\n");

      // Set zoom to 1.5x
      pdfStore.setZoom(targetZoom);

      render(
        <StoreProvider value={rootStore}>
          <PdfViewer store={pdfStore} />
        </StoreProvider>,
      );

      // Wait for initial render
      await waitForPagesRendered(1);

      // Jump to middle of document
      const middlePage = Math.floor(pdfStore.pageCount / 2);
      console.log(`Jumping to page ${middlePage} at 1.5x zoom...`);

      const jumpTime = await scrollToPage(middlePage);
      metrics.push({
        operation: "1.5x_zoom_jump_to_middle",
        duration: jumpTime,
        timestamp: Date.now(),
        zoom: targetZoom,
      });

      // Wait for renders to complete
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Heavy scroll test - 10 pages down
      console.log("Heavy scrolling test: 10 pages down at 1.5x zoom...");
      const heavyScrollDown = await smoothScrollPages("down", 10);
      metrics.push(
        ...heavyScrollDown.map((m, i) => ({
          ...m,
          operation: `1.5x_heavy_scroll_down_${i + 1}`,
          zoom: targetZoom,
        })),
      );

      // Wait briefly
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Rapid scroll up test - 8 pages
      console.log("Rapid scroll test: 8 pages up at 1.5x zoom...");
      const rapidScrollUp = await smoothScrollPages("up", 8);
      metrics.push(
        ...rapidScrollUp.map((m, i) => ({
          ...m,
          operation: `1.5x_rapid_scroll_up_${i + 1}`,
          zoom: targetZoom,
        })),
      );

      // Calculate statistics
      const allScrollTimes = [...heavyScrollDown, ...rapidScrollUp].map(
        (m) => m.duration,
      );
      const avgTime =
        allScrollTimes.reduce((a, b) => a + b, 0) / allScrollTimes.length;
      const maxTime = Math.max(...allScrollTimes);
      const minTime = Math.min(...allScrollTimes);

      console.log("\n📊 1.5x Zoom Performance Results:");
      console.log(`Average scroll time: ${Math.round(avgTime)}ms`);
      console.log(`Min scroll time: ${Math.round(minTime)}ms`);
      console.log(`Max scroll time: ${Math.round(maxTime)}ms`);
      console.log(`Jump time: ${Math.round(jumpTime)}ms`);

      logPerformanceMetrics(metrics, PERF_THRESHOLDS.scrollSmooth);

      // Assertions - 1.5x zoom should not be more than 50% slower than baseline
      expect(avgTime).toBeLessThan(PERF_THRESHOLDS.scrollSmooth * 1.5);
      expect(maxTime).toBeLessThan(PERF_THRESHOLDS.scrollSmooth * 2);
      expect(jumpTime).toBeLessThan(PERF_THRESHOLDS.jumpScroll * 1.3);

      console.log("\n✅ 1.5x zoom performance test completed");
    }, 45000);
  });

  describe("Full Performance Suite", () => {
    it("should run complete performance test suite", async () => {
      const metrics: PerformanceMetrics[] = [];

      render(
        <StoreProvider value={rootStore}>
          <PdfViewer store={pdfStore} />
        </StoreProvider>,
      );

      // Wait for initial render
      await waitForPagesRendered(1);

      console.log("\n🚀 Starting Full Performance Suite...\n");
      console.log(`Testing PDF with ${pdfStore.pageCount} pages\n`);

      // Step 1: Jump to middle
      const middlePage = Math.floor(pdfStore.pageCount / 2);
      console.log(
        `Step 1: Jump scroll to middle of book (page ${middlePage})...`,
      );
      const jumpMiddleTime = await scrollToPage(middlePage);
      metrics.push({
        operation: "step1_jump_to_middle",
        duration: jumpMiddleTime,
        timestamp: Date.now(),
        zoom: pdfStore.zoom,
        pageCount: pdfStore.pageCount,
      });

      const renderMiddleTime = await measurePageRenderTime(middlePage);
      metrics.push({
        operation: "step1_render_middle_page",
        duration: renderMiddleTime,
        timestamp: Date.now(),
        zoom: pdfStore.zoom,
      });

      // Step 2: Scroll down a few pages
      console.log("\nStep 2: Scroll down few pages...");
      const scrollDownMetrics = await smoothScrollPages("down", 3);
      metrics.push(
        ...scrollDownMetrics.map((m) => ({
          ...m,
          operation: `step2_${m.operation}`,
        })),
      );

      // Step 3: Scroll up a few pages
      console.log("\nStep 3: Scroll up few pages...");
      const scrollUpMetrics = await smoothScrollPages("up", 3);
      metrics.push(
        ...scrollUpMetrics.map((m) => ({
          ...m,
          operation: `step3_${m.operation}`,
        })),
      );

      // Step 4: Jump to end
      const endPage = Math.max(1, pdfStore.pageCount - 5);
      console.log(`\nStep 4: Jump to end of book (page ${endPage})...`);
      const jumpEndTime = await scrollToPage(endPage);
      metrics.push({
        operation: "step4_jump_to_end",
        duration: jumpEndTime,
        timestamp: Date.now(),
        zoom: pdfStore.zoom,
      });

      // Step 5: Jump back to start
      console.log("\nStep 5: Jump back to start (page 1)...");
      const jumpStartTime = await scrollToPage(1);
      metrics.push({
        operation: "step5_jump_to_start",
        duration: jumpStartTime,
        timestamp: Date.now(),
        zoom: pdfStore.zoom,
      });

      // Log final results
      console.log("\n📊 Full Suite Results:");
      const { avgDuration, slowOps } = logPerformanceMetrics(
        metrics,
        PERF_THRESHOLDS.scrollSmooth,
      );

      allMetrics.push(...metrics);

      // Assert overall performance
      expect(slowOps).toBeLessThan(metrics.length * 0.3); // Allow up to 30% slow operations
      expect(avgDuration).toBeLessThan(PERF_THRESHOLDS.jumpScroll);

      console.log("\n✅ Performance suite completed!");
    }, 30000);
  });
});
