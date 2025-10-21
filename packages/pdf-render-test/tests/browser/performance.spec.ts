import { describe, expect, it } from "vitest";
import { createPdfjsEngine } from "../../src/engines/pdfjs.js";
import { createPdfiumEngine } from "../../src/engines/pdfium.js";
import { runBatch } from "../../src/harness/runBatch.js";
import { formatBatchReport } from "../../src/utils/format.js";

async function fetchRootPdf(path = "/sample.pdf") {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to fetch ${path}`);
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

function canvasFactory(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  document.body.appendChild(c);
  return c;
}

function cleanupCanvases() {
  const canvases = Array.from(document.querySelectorAll("canvas"));
  for (const canvas of canvases) {
    canvas.remove();
  }
}

describe("Performance: 25-page batch rendering", () => {
  it("PDF.js: renders 25 pages and measures memory", async () => {
    cleanupCanvases();
    const data = await fetchRootPdf("/sample.pdf");
    const engine = createPdfjsEngine();

    const report = await runBatch({
      engine,
      data,
      pages: 25,
      canvasFactory,
      collectPerPage: false, // faster without per-page collection
    });

    console.log("\n=== PDF.js 25-page Report ===");
    console.log(formatBatchReport(report));

    expect(report.pages_requested).toBe(25);
    expect(report.pages_rendered).toBe(25);
    expect(report.total_render_ms).toBeGreaterThan(0);
    expect(report.pages_per_sec).toBeGreaterThan(0);
    expect(report.canvas_estimated_delta_bytes).toBeGreaterThan(0);

    cleanupCanvases();
  }, 120_000); // 2 min timeout

  it("PDFium: renders 25 pages and measures memory", async () => {
    cleanupCanvases();
    const data = await fetchRootPdf("/sample.pdf");
    const engine = createPdfiumEngine("/pdfium.wasm");

    const report = await runBatch({
      engine,
      data,
      pages: 25,
      canvasFactory,
      collectPerPage: false,
    });

    console.log("\n=== PDFium 25-page Report ===");
    console.log(formatBatchReport(report));

    expect(report.pages_requested).toBe(25);
    expect(report.pages_rendered).toBe(25);
    expect(report.total_render_ms).toBeGreaterThan(0);
    expect(report.pages_per_sec).toBeGreaterThan(0);
    expect(report.canvas_estimated_delta_bytes).toBeGreaterThan(0);

    cleanupCanvases();
  }, 120_000);
});

describe("Performance: 50-page batch rendering", () => {
  it("PDF.js: renders 50 pages and measures memory", async () => {
    cleanupCanvases();
    const data = await fetchRootPdf("/sample.pdf");
    const engine = createPdfjsEngine();

    const report = await runBatch({
      engine,
      data,
      pages: 50,
      canvasFactory,
      collectPerPage: false,
    });

    console.log("\n=== PDF.js 50-page Report ===");
    console.log(formatBatchReport(report));

    expect(report.pages_requested).toBe(50);
    expect(report.pages_rendered).toBe(50);
    expect(report.total_render_ms).toBeGreaterThan(0);
    expect(report.pages_per_sec).toBeGreaterThan(0);
    expect(report.canvas_estimated_delta_bytes).toBeGreaterThan(0);

    cleanupCanvases();
  }, 180_000); // 3 min timeout

  it("PDFium: renders 50 pages and measures memory", async () => {
    cleanupCanvases();
    const data = await fetchRootPdf("/sample.pdf");
    const engine = createPdfiumEngine("/pdfium.wasm");

    const report = await runBatch({
      engine,
      data,
      pages: 50,
      canvasFactory,
      collectPerPage: false,
    });

    console.log("\n=== PDFium 50-page Report ===");
    console.log(formatBatchReport(report));

    expect(report.pages_requested).toBe(50);
    expect(report.pages_rendered).toBe(50);
    expect(report.total_render_ms).toBeGreaterThan(0);
    expect(report.pages_per_sec).toBeGreaterThan(0);
    expect(report.canvas_estimated_delta_bytes).toBeGreaterThan(0);

    cleanupCanvases();
  }, 180_000);
});

describe("Performance: 20 canvases on single page (memory stress test)", () => {
  it("PDF.js: renders same page 20 times and holds in memory", async () => {
    cleanupCanvases();
    const data = await fetchRootPdf("/sample.pdf");
    const engine = createPdfjsEngine();

    const report = await runBatch({
      engine,
      data,
      pages: 20,
      startPage: 1, // render page 1 twenty times
      canvasFactory,
      collectPerPage: false,
    });

    console.log("\n=== PDF.js 20-canvas Memory Test ===");
    console.log(formatBatchReport(report));

    const canvases = document.querySelectorAll("canvas");
    expect(canvases.length).toBe(20);

    expect(report.pages_requested).toBe(20);
    expect(report.pages_rendered).toBe(20);
    expect(report.canvas_estimated_delta_bytes).toBeGreaterThan(0);

    cleanupCanvases();
  }, 120_000);

  it("PDFium: renders same page 20 times and holds in memory", async () => {
    cleanupCanvases();
    const data = await fetchRootPdf("/sample.pdf");
    const engine = createPdfiumEngine("/pdfium.wasm");

    const report = await runBatch({
      engine,
      data,
      pages: 20,
      startPage: 1,
      canvasFactory,
      collectPerPage: false,
    });

    console.log("\n=== PDFium 20-canvas Memory Test ===");
    console.log(formatBatchReport(report));

    const canvases = document.querySelectorAll("canvas");
    expect(canvases.length).toBe(20);

    expect(report.pages_requested).toBe(20);
    expect(report.pages_rendered).toBe(20);
    expect(report.canvas_estimated_delta_bytes).toBeGreaterThan(0);

    cleanupCanvases();
  }, 120_000);
});

describe("Performance: Render time comparison at 1x PPI (96 DPI)", () => {
  it("compares PDF.js vs PDFium render speed for 10 pages", async () => {
    cleanupCanvases();

    // Test PDF.js
    const pdfjsData = await fetchRootPdf("/sample.pdf");
    const pdfjsEngine = createPdfjsEngine();
    const pdfjsReport = await runBatch({
      engine: pdfjsEngine,
      data: pdfjsData,
      pages: 10,
      ppi: 96, // explicitly set 1x PPI
      canvasFactory,
      collectPerPage: false,
    });

    cleanupCanvases();

    // Test PDFium - fetch data again to avoid detached ArrayBuffer
    const pdfiumData = await fetchRootPdf("/sample.pdf");
    const pdfiumEngine = createPdfiumEngine("/pdfium.wasm");
    const pdfiumReport = await runBatch({
      engine: pdfiumEngine,
      data: pdfiumData,
      pages: 10,
      ppi: 96,
      canvasFactory,
      collectPerPage: false,
    });

    console.log("\n=== Render Speed Comparison (10 pages @ 96 DPI) ===");
    console.log("\nPDF.js:");
    console.log(formatBatchReport(pdfjsReport));
    console.log("\nPDFium:");
    console.log(formatBatchReport(pdfiumReport));

    expect(pdfjsReport.pages_requested).toBe(10);
    expect(pdfjsReport.pages_rendered).toBe(10);
    expect(pdfiumReport.pages_requested).toBe(10);
    expect(pdfiumReport.pages_rendered).toBe(10);

    // Both should have positive render times
    expect(pdfjsReport.total_render_ms).toBeGreaterThan(0);
    expect(pdfiumReport.total_render_ms).toBeGreaterThan(0);

    // Log which is faster
    const faster =
      pdfjsReport.pages_per_sec > pdfiumReport.pages_per_sec
        ? "PDF.js"
        : "PDFium";
    const speedup =
      Math.max(pdfjsReport.pages_per_sec, pdfiumReport.pages_per_sec) /
      Math.min(pdfjsReport.pages_per_sec, pdfiumReport.pages_per_sec);

    console.log(`\n${faster} is ${speedup.toFixed(2)}x faster for this PDF\n`);

    cleanupCanvases();
  }, 120_000);
});

describe("Performance: Per-page metrics collection", () => {
  it("PDF.js: collects detailed per-page metrics for 5 pages", async () => {
    cleanupCanvases();
    const data = await fetchRootPdf("/sample.pdf");
    const engine = createPdfjsEngine();

    const report = await runBatch({
      engine,
      data,
      pages: 5,
      canvasFactory,
      collectPerPage: true, // enable per-page collection
    });

    console.log("\n=== PDF.js Per-Page Metrics (5 pages) ===");
    console.log(formatBatchReport(report));

    expect(report.pages_requested).toBe(5);
    expect(report.pages_rendered).toBe(5);
    expect(report.per_page).toBeDefined();
    expect(report.per_page?.length).toBe(5);

    // Each page should have render time and memory after
    for (const page of report.per_page ?? []) {
      expect(page.render_ms).toBeGreaterThan(0);
      expect(page.memory_after).toBeDefined();
    }

    cleanupCanvases();
  }, 120_000);

  it("PDFium: collects detailed per-page metrics for 5 pages", async () => {
    cleanupCanvases();
    const data = await fetchRootPdf("/sample.pdf");
    const engine = createPdfiumEngine("/pdfium.wasm");

    const report = await runBatch({
      engine,
      data,
      pages: 5,
      canvasFactory,
      collectPerPage: true,
    });

    console.log("\n=== PDFium Per-Page Metrics (5 pages) ===");
    console.log(formatBatchReport(report));

    expect(report.pages_requested).toBe(5);
    expect(report.pages_rendered).toBe(5);
    expect(report.per_page).toBeDefined();
    expect(report.per_page?.length).toBe(5);

    for (const page of report.per_page ?? []) {
      expect(page.render_ms).toBeGreaterThan(0);
      expect(page.memory_after).toBeDefined();
    }

    cleanupCanvases();
  }, 120_000);
});
