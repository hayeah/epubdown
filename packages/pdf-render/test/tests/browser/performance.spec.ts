import { describe, expect, it } from "vitest";
import { createPdfjsEngine } from "../../src/engines/pdfjs.js";
import { createPdfiumEngine } from "../../src/engines/pdfium.js";
import { runBatch } from "../../src/harness/runBatch.js";
import { formatBatchReport } from "../../src/utils/format.js";
import { getSimpleTestPdf } from "../../src/fixtures/testPdf.js";

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

describe("Performance: 3-page batch rendering", () => {
  it("PDF.js: renders 3 pages and measures memory", async () => {
    cleanupCanvases();
    const data = await getSimpleTestPdf();
    const engine = createPdfjsEngine();

    const report = await runBatch({
      engine,
      data,
      pages: 3,
      canvasFactory,
      collectPerPage: false, // faster without per-page collection
    });

    console.log("\n=== PDF.js 3-page Report ===");
    console.log(formatBatchReport(report));

    expect(report.pages_requested).toBe(3);
    expect(report.pages_rendered).toBe(3);
    expect(report.total_render_ms).toBeGreaterThan(0);
    expect(report.pages_per_sec).toBeGreaterThan(0);
    expect(report.canvas_estimated_delta_bytes).toBeGreaterThan(0);

    cleanupCanvases();
  }, 120_000); // 2 min timeout

  it("PDFium: renders 3 pages and measures memory", async () => {
    cleanupCanvases();
    const data = await getSimpleTestPdf();
    const engine = createPdfiumEngine();

    const report = await runBatch({
      engine,
      data,
      pages: 3,
      canvasFactory,
      collectPerPage: false,
    });

    console.log("\n=== PDFium 3-page Report ===");
    console.log(formatBatchReport(report));

    expect(report.pages_requested).toBe(3);
    expect(report.pages_rendered).toBe(3);
    expect(report.total_render_ms).toBeGreaterThan(0);
    expect(report.pages_per_sec).toBeGreaterThan(0);
    expect(report.canvas_estimated_delta_bytes).toBeGreaterThan(0);

    cleanupCanvases();
  }, 120_000);
});

describe("Performance: Render time comparison at 1x PPI (96 DPI)", () => {
  it("compares PDF.js vs PDFium render speed for 3 pages", async () => {
    cleanupCanvases();

    // Test PDF.js
    const pdfjsData = await getSimpleTestPdf();
    const pdfjsEngine = createPdfjsEngine();
    const pdfjsReport = await runBatch({
      engine: pdfjsEngine,
      data: pdfjsData,
      pages: 3,
      ppi: 96, // explicitly set 1x PPI
      canvasFactory,
      collectPerPage: false,
    });

    cleanupCanvases();

    // Test PDFium - use fresh data to avoid detached ArrayBuffer
    const pdfiumData = await getSimpleTestPdf();
    const pdfiumEngine = createPdfiumEngine();
    const pdfiumReport = await runBatch({
      engine: pdfiumEngine,
      data: pdfiumData,
      pages: 3,
      ppi: 96,
      canvasFactory,
      collectPerPage: false,
    });

    console.log("\n=== Render Speed Comparison (3 pages @ 96 DPI) ===");
    console.log("\nPDF.js:");
    console.log(formatBatchReport(pdfjsReport));
    console.log("\nPDFium:");
    console.log(formatBatchReport(pdfiumReport));

    expect(pdfjsReport.pages_requested).toBe(3);
    expect(pdfjsReport.pages_rendered).toBe(3);
    expect(pdfiumReport.pages_requested).toBe(3);
    expect(pdfiumReport.pages_rendered).toBe(3);

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
  it("PDF.js: collects detailed per-page metrics for 3 pages", async () => {
    cleanupCanvases();
    const data = await getSimpleTestPdf();
    const engine = createPdfjsEngine();

    const report = await runBatch({
      engine,
      data,
      pages: 3,
      canvasFactory,
      collectPerPage: true, // enable per-page collection
    });

    console.log("\n=== PDF.js Per-Page Metrics (3 pages) ===");
    console.log(formatBatchReport(report));

    expect(report.pages_requested).toBe(3);
    expect(report.pages_rendered).toBe(3);
    expect(report.per_page).toBeDefined();
    expect(report.per_page?.length).toBe(3);

    // Each page should have render time and memory after
    for (const page of report.per_page ?? []) {
      expect(page.render_ms).toBeGreaterThan(0);
      expect(page.memory_after).toBeDefined();
    }

    cleanupCanvases();
  }, 120_000);

  it("PDFium: collects detailed per-page metrics for 3 pages", async () => {
    cleanupCanvases();
    const data = await getSimpleTestPdf();
    const engine = createPdfiumEngine();

    const report = await runBatch({
      engine,
      data,
      pages: 3,
      canvasFactory,
      collectPerPage: true,
    });

    console.log("\n=== PDFium Per-Page Metrics (3 pages) ===");
    console.log(formatBatchReport(report));

    expect(report.pages_requested).toBe(3);
    expect(report.pages_rendered).toBe(3);
    expect(report.per_page).toBeDefined();
    expect(report.per_page?.length).toBe(3);

    for (const page of report.per_page ?? []) {
      expect(page.render_ms).toBeGreaterThan(0);
      expect(page.memory_after).toBeDefined();
    }

    cleanupCanvases();
  }, 120_000);
});
