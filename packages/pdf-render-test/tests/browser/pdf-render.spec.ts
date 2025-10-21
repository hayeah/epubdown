import { describe, expect, it } from "vitest";
import { createPdfjsEngine } from "../../src/engines/pdfjs.js";
import { runBatch } from "../../src/harness/runBatch.js";

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

describe("browser: render a few pages (PDF.js)", () => {
  it("renders 3 pages and reports metrics", async () => {
    const data = await fetchRootPdf("/sample.pdf");
    const engine = createPdfjsEngine();

    const report = await runBatch({ engine, data, pages: 3, canvasFactory });
    expect(report.pages_rendered).toBe(3);
    expect(report.pages_requested).toBe(3);
    expect(report.total_render_ms).toBeGreaterThan(0);
    expect(report.pages_per_sec).toBeGreaterThan(0);
    // UA memory may be null; canvas estimate should grow
    expect(report.canvas_estimated_delta_bytes).toBeGreaterThan(0);
  }, 120_000);
});
