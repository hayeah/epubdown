import { describe, expect, it } from "vitest";
import { server } from "@vitest/browser/context";

declare global {
  interface Window {
    PDFScrollViewer?: any;
    PDFiumScrollViewer?: any;
    pdfViewer?: any;
    initPDFium?: (config: { wasmBinary: ArrayBuffer }) => Promise<any>;
    pdfjsLib?: any;
  }
}

const TOTAL_PAGES = 90;

const waitFor = async (
  predicate: () => boolean | Promise<boolean>,
  timeout = 4_000,
  interval = 25,
) => {
  const deadline = Date.now() + timeout;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const result = await predicate();
      if (result) return;
    } catch {
      // ignore predicate errors until timeout
    }

    if (Date.now() > deadline) {
      throw new Error("waitFor timed out");
    }

    await new Promise((resolve) => setTimeout(resolve, interval));
  }
};

interface PerformanceMetrics {
  initTime: number;
  firstPageRenderTime: number;
  scrollToPage10Time: number;
  scrollToLastPageTime: number;
  memoryUsed?: number;
}

async function measurePDFjsPerformance(): Promise<PerformanceMetrics> {
  const startTime = performance.now();

  // Load HTML
  const html = await server.commands.readFile("./index-pdfjs.html", "utf-8");
  const parsed = new DOMParser().parseFromString(html, "text/html");

  // Load PDF.js from CDN
  const pdfJsScript = document.createElement("script");
  pdfJsScript.src =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
  document.head.appendChild(pdfJsScript);

  await waitFor(
    () => typeof window.pdfjsLib !== "undefined",
    10_000,
  );

  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

  // Set up HTML
  document.body.innerHTML = parsed.body.innerHTML;
  document.body.style.margin = "0";

  const container = document.getElementById("pdf-scroll-container") as HTMLElement;
  Object.assign(container.style, {
    height: "600px",
    width: "800px",
    overflowY: "auto",
    overflowX: "hidden",
    position: "relative",
  });

  const viewerStartTime = performance.now();
  await import("./viewer-scroll.js");
  document.dispatchEvent(new Event("DOMContentLoaded"));

  await waitFor(() => Boolean(window.PDFScrollViewer?.pdfDoc));
  const initTime = performance.now() - viewerStartTime;

  // Measure first page render
  const firstPageStartTime = performance.now();
  await waitFor(() => {
    const firstPage = document.querySelector('[data-page-num="1"]');
    const canvas = firstPage?.querySelector(".pdf-page-canvas") as HTMLCanvasElement;
    return Boolean(canvas?.style.display === "block" && canvas.width > 0);
  });
  const firstPageRenderTime = performance.now() - firstPageStartTime;

  // Measure scroll to page 10
  const scrollToPage10StartTime = performance.now();
  const targetElement10 = document.querySelector('[data-page-num="10"]') as HTMLElement;
  targetElement10.scrollIntoView({ behavior: "instant", block: "start" });
  container.dispatchEvent(new Event("scroll"));

  await waitFor(() => {
    const visible = window.PDFScrollViewer?.getVisiblePageNumbers() ?? [];
    return visible.includes(10);
  });
  const scrollToPage10Time = performance.now() - scrollToPage10StartTime;

  // Measure scroll to last page
  const scrollToLastPageStartTime = performance.now();
  const targetElementLast = document.querySelector(`[data-page-num="${TOTAL_PAGES}"]`) as HTMLElement;
  targetElementLast.scrollIntoView({ behavior: "instant", block: "start" });
  container.dispatchEvent(new Event("scroll"));

  await waitFor(() => {
    const visible = window.PDFScrollViewer?.getVisiblePageNumbers() ?? [];
    return visible.includes(TOTAL_PAGES);
  });
  const scrollToLastPageTime = performance.now() - scrollToLastPageStartTime;

  // Try to get memory usage if available
  let memoryUsed: number | undefined;
  if ('memory' in performance) {
    memoryUsed = (performance as any).memory.usedJSHeapSize;
  }

  return {
    initTime,
    firstPageRenderTime,
    scrollToPage10Time,
    scrollToLastPageTime,
    memoryUsed,
  };
}

async function measurePDFiumPerformance(): Promise<PerformanceMetrics> {
  const startTime = performance.now();

  // Load HTML
  const html = await server.commands.readFile("./index-pdfium.html", "utf-8");
  const parsed = new DOMParser().parseFromString(html, "text/html");

  // Load PDFium from CDN
  const pdfiumScript = document.createElement("script");
  pdfiumScript.type = "module";
  pdfiumScript.textContent = `
    import { init } from 'https://cdn.jsdelivr.net/npm/@embedpdf/pdfium@1/+esm';
    window.initPDFium = init;
  `;
  document.head.appendChild(pdfiumScript);

  await waitFor(
    () => typeof window.initPDFium !== "undefined",
    10_000,
  );

  // Set up HTML
  document.body.innerHTML = parsed.body.innerHTML;
  document.body.style.margin = "0";

  const container = document.getElementById("pdf-scroll-container") as HTMLElement;
  Object.assign(container.style, {
    height: "600px",
    width: "800px",
    overflowY: "auto",
    overflowX: "hidden",
    position: "relative",
  });

  const viewerStartTime = performance.now();
  await import("./viewer-pdfium.js");
  document.dispatchEvent(new Event("DOMContentLoaded"));

  await waitFor(() => Boolean(window.pdfViewer?.pdfDocument));
  const initTime = performance.now() - viewerStartTime;

  // Measure first page render
  const firstPageStartTime = performance.now();
  await waitFor(() => {
    const firstPage = document.querySelector('[data-page-num="1"]');
    const canvas = firstPage?.querySelector(".pdf-page-canvas") as HTMLCanvasElement;
    return Boolean(canvas?.style.display === "block" && canvas.width > 0);
  });
  const firstPageRenderTime = performance.now() - firstPageStartTime;

  // Measure scroll to page 10
  const scrollToPage10StartTime = performance.now();
  const targetElement10 = document.querySelector('[data-page-num="10"]') as HTMLElement;
  targetElement10.scrollIntoView({ behavior: "instant", block: "start" });
  container.dispatchEvent(new Event("scroll"));

  await waitFor(() => {
    const visible = window.pdfViewer?.getVisiblePageNumbers() ?? [];
    return visible.includes(10);
  });
  const scrollToPage10Time = performance.now() - scrollToPage10StartTime;

  // Measure scroll to last page
  const scrollToLastPageStartTime = performance.now();
  const targetElementLast = document.querySelector(`[data-page-num="${TOTAL_PAGES}"]`) as HTMLElement;
  targetElementLast.scrollIntoView({ behavior: "instant", block: "start" });
  container.dispatchEvent(new Event("scroll"));

  await waitFor(() => {
    const visible = window.pdfViewer?.getVisiblePageNumbers() ?? [];
    return visible.includes(TOTAL_PAGES);
  });
  const scrollToLastPageTime = performance.now() - scrollToLastPageStartTime;

  // Try to get memory usage if available
  let memoryUsed: number | undefined;
  if ('memory' in performance) {
    memoryUsed = (performance as any).memory.usedJSHeapSize;
  }

  return {
    initTime,
    firstPageRenderTime,
    scrollToPage10Time,
    scrollToLastPageTime,
    memoryUsed,
  };
}

describe("PDF Viewer Performance Comparison", () => {
  it("compares PDF.js vs PDFium performance", { timeout: 3000000 }, async () => {
    console.log("Starting performance comparison test...");

    // Run PDF.js test
    console.log("Testing PDF.js implementation...");
    const pdfjsMetrics = await measurePDFjsPerformance();

    // Clean up
    document.body.innerHTML = "";
    delete window.PDFScrollViewer;

    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Run PDFium test
    console.log("Testing PDFium implementation...");
    const pdfiumMetrics = await measurePDFiumPerformance();

    // Compare and log results
    console.log("\n=== Performance Comparison Results ===\n");

    console.log("Initialization Time:");
    console.log(`  PDF.js:  ${pdfjsMetrics.initTime.toFixed(2)}ms`);
    console.log(`  PDFium:  ${pdfiumMetrics.initTime.toFixed(2)}ms`);
    console.log(`  Winner:  ${pdfjsMetrics.initTime < pdfiumMetrics.initTime ? 'PDF.js' : 'PDFium'} (${Math.abs(pdfjsMetrics.initTime - pdfiumMetrics.initTime).toFixed(2)}ms faster)\n`);

    console.log("First Page Render Time:");
    console.log(`  PDF.js:  ${pdfjsMetrics.firstPageRenderTime.toFixed(2)}ms`);
    console.log(`  PDFium:  ${pdfiumMetrics.firstPageRenderTime.toFixed(2)}ms`);
    console.log(`  Winner:  ${pdfjsMetrics.firstPageRenderTime < pdfiumMetrics.firstPageRenderTime ? 'PDF.js' : 'PDFium'} (${Math.abs(pdfjsMetrics.firstPageRenderTime - pdfiumMetrics.firstPageRenderTime).toFixed(2)}ms faster)\n`);

    console.log("Scroll to Page 10 Time:");
    console.log(`  PDF.js:  ${pdfjsMetrics.scrollToPage10Time.toFixed(2)}ms`);
    console.log(`  PDFium:  ${pdfiumMetrics.scrollToPage10Time.toFixed(2)}ms`);
    console.log(`  Winner:  ${pdfjsMetrics.scrollToPage10Time < pdfiumMetrics.scrollToPage10Time ? 'PDF.js' : 'PDFium'} (${Math.abs(pdfjsMetrics.scrollToPage10Time - pdfiumMetrics.scrollToPage10Time).toFixed(2)}ms faster)\n`);

    console.log("Scroll to Last Page Time:");
    console.log(`  PDF.js:  ${pdfjsMetrics.scrollToLastPageTime.toFixed(2)}ms`);
    console.log(`  PDFium:  ${pdfiumMetrics.scrollToLastPageTime.toFixed(2)}ms`);
    console.log(`  Winner:  ${pdfjsMetrics.scrollToLastPageTime < pdfiumMetrics.scrollToLastPageTime ? 'PDF.js' : 'PDFium'} (${Math.abs(pdfjsMetrics.scrollToLastPageTime - pdfiumMetrics.scrollToLastPageTime).toFixed(2)}ms faster)\n`);

    if (pdfjsMetrics.memoryUsed && pdfiumMetrics.memoryUsed) {
      console.log("Memory Usage:");
      console.log(`  PDF.js:  ${(pdfjsMetrics.memoryUsed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  PDFium:  ${(pdfiumMetrics.memoryUsed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Winner:  ${pdfjsMetrics.memoryUsed < pdfiumMetrics.memoryUsed ? 'PDF.js' : 'PDFium'} (${Math.abs((pdfjsMetrics.memoryUsed - pdfiumMetrics.memoryUsed) / 1024 / 1024).toFixed(2)}MB less)\n`);
    }

    // Calculate overall winner
    let pdfjsWins = 0;
    let pdfiumWins = 0;

    if (pdfjsMetrics.initTime < pdfiumMetrics.initTime) pdfjsWins++; else pdfiumWins++;
    if (pdfjsMetrics.firstPageRenderTime < pdfiumMetrics.firstPageRenderTime) pdfjsWins++; else pdfiumWins++;
    if (pdfjsMetrics.scrollToPage10Time < pdfiumMetrics.scrollToPage10Time) pdfjsWins++; else pdfiumWins++;
    if (pdfjsMetrics.scrollToLastPageTime < pdfiumMetrics.scrollToLastPageTime) pdfjsWins++; else pdfiumWins++;

    console.log("=== Overall Winner ===");
    console.log(`${pdfjsWins > pdfiumWins ? 'PDF.js' : 'PDFium'} (Won ${Math.max(pdfjsWins, pdfiumWins)} out of 4 metrics)`);

    // Store results for assertions
    expect(pdfjsMetrics.initTime).toBeGreaterThan(0);
    expect(pdfiumMetrics.initTime).toBeGreaterThan(0);
    expect(pdfjsMetrics.firstPageRenderTime).toBeGreaterThan(0);
    expect(pdfiumMetrics.firstPageRenderTime).toBeGreaterThan(0);
  });
});