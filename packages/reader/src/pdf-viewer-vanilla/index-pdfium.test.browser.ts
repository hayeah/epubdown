import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { server } from "@vitest/browser/context";

declare global {
  interface Window {
    PDFiumScrollViewer?: {
      pdfDocument: any | null;
      currentPageSpan: HTMLElement;
      zoomLevelSpan: HTMLElement;
      updateVisiblePages(): void;
      getVisiblePageNumbers(): number[];
    };
    pdfViewer?: any;
    initPDFium?: (config: { wasmBinary: ArrayBuffer }) => Promise<any>;
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

describe("vanilla pdf viewer - PDFium", () => {
  let restoreIntersectionObserver: (() => void) | undefined;

  beforeEach(async () => {
    vi.restoreAllMocks();
    const html = await server.commands.readFile("./index-pdfium.html", "utf-8");

    const parsed = new DOMParser().parseFromString(html, "text/html");

    // Load PDFium from CDN first
    const pdfiumScript = document.createElement("script");
    pdfiumScript.type = "module";
    pdfiumScript.textContent = `
      import { init } from 'https://cdn.jsdelivr.net/npm/@embedpdf/pdfium@1/+esm';
      window.initPDFium = init;
    `;
    document.head.appendChild(pdfiumScript);

    // Wait for PDFium init function to be available
    await waitFor(
      () => typeof window.initPDFium !== "undefined",
      10_000,
    );

    // Now set up the HTML
    document.body.innerHTML = parsed.body.innerHTML;
    document.body.style.margin = "0";

    const container = document.getElementById(
      "pdf-scroll-container",
    ) as HTMLElement | null;
    if (!container) {
      throw new Error("PDF scroll container not found");
    }

    Object.assign(container.style, {
      height: "600px",
      width: "800px",
      overflowY: "auto",
      overflowX: "hidden",
      position: "relative",
    });

    await import("./viewer-pdfium.js");
    document.dispatchEvent(new Event("DOMContentLoaded"));

    // Wait for PDFium viewer to be initialized
    await waitFor(() => Boolean(window.pdfViewer));
    await waitFor(() => Boolean(window.pdfViewer?.pdfDocument));
    await waitFor(
      () =>
        document.querySelectorAll(".pdf-page-container").length === TOTAL_PAGES,
    );
    await waitFor(() => {
      const current = document.getElementById("current-page");
      return Boolean(current?.textContent && current.textContent !== "-");
    });

    // Wait for at least the first page to be rendered to canvas
    // This ensures the IntersectionObserver has triggered and initial pages are rendered
    await waitFor(() => {
      const firstPage = document.querySelector('[data-page-num="1"]');
      const canvas = firstPage?.querySelector(
        ".pdf-page-canvas",
      ) as HTMLCanvasElement;
      return Boolean(canvas?.style.display === "block" && canvas.width > 0);
    });
  });

  it(
    "starts on page 1 and updates when scrolling to page 10",
    { timeout: 1500000 },
    async () => {
      const currentPage = document.getElementById(
        "current-page",
      ) as HTMLElement | null;
      const viewer = window.pdfViewer;
      const initialVisible = viewer?.getVisiblePageNumbers() ?? [];
      expect(initialVisible[0]).toBe(1);

      const container = document.getElementById(
        "pdf-scroll-container",
      ) as HTMLElement;
      expect(container.scrollTop).toBe(0);

      // Wait a bit longer to ensure pages are rendering before we scroll
      await new Promise((resolve) => setTimeout(resolve, 500));

      const targetPage = 10;
      const targetElement = document.querySelector(
        `[data-page-num="${targetPage}"]`,
      ) as HTMLElement;
      const targetRect = targetElement.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      container.scrollTop += targetRect.top - containerRect.top;
      container.dispatchEvent(new Event("scroll"));
      await new Promise((resolve) => setTimeout(resolve, 150));
      viewer?.updateVisiblePages();

      await waitFor(
        () => {
          const visible = viewer?.getVisiblePageNumbers() ?? [];
          return visible.includes(targetPage);
        },
        3_000,
        50,
      );

      viewer?.updateVisiblePages();
      const pageText = currentPage?.textContent ?? "";
      // PDFium viewer shows single page number, not range
      const pageNum = Number.parseInt(pageText, 10);
      expect(pageNum).toBeGreaterThanOrEqual(targetPage - 1);
      expect(pageNum).toBeLessThanOrEqual(targetPage + 1);
    },
  );

  it("scrolls to last page from page one", { timeout: 1500000 }, async () => {
    const currentPage = document.getElementById(
      "current-page",
    ) as HTMLElement | null;
    const viewer = window.pdfViewer;
    const initialVisible = viewer?.getVisiblePageNumbers() ?? [];
    expect(initialVisible[0]).toBe(1);

    const container = document.getElementById(
      "pdf-scroll-container",
    ) as HTMLElement;
    expect(container.scrollTop).toBe(0);

    // Wait a bit longer to ensure pages are rendering before we scroll
    await new Promise((resolve) => setTimeout(resolve, 500));

    const targetPage = TOTAL_PAGES;
    const targetElement = document.querySelector(
      `[data-page-num="${targetPage}"]`,
    ) as HTMLElement;

    // Use scrollIntoView for large jumps to handle elements far outside viewport
    targetElement.scrollIntoView({ behavior: "instant", block: "start" });
    container.dispatchEvent(new Event("scroll"));
    await new Promise((resolve) => setTimeout(resolve, 300));
    viewer?.updateVisiblePages();

    await waitFor(
      () => {
        const visible = viewer?.getVisiblePageNumbers() ?? [];
        return visible.includes(targetPage);
      },
      5_000,
      50,
    );

    viewer?.updateVisiblePages();
    const pageText = currentPage?.textContent ?? "";
    // PDFium viewer shows single page number, not range
    const pageNum = Number.parseInt(pageText, 10);
    expect(pageNum).toBeGreaterThanOrEqual(targetPage - 1);
    expect(pageNum).toBeLessThanOrEqual(targetPage + 1);
  });

  it(
    "changes zoom level via the zoom controls",
    { timeout: 1500000 },
    async () => {
      const zoomLevel = document.getElementById("zoom-level") as HTMLElement;
      const zoomIn = document.getElementById("zoom-in") as HTMLButtonElement;
      const zoomOut = document.getElementById("zoom-out") as HTMLButtonElement;
      const firstPage = document.querySelector(
        '[data-page-num="2"]',
      ) as HTMLElement;

      expect(zoomLevel.textContent).toBe("100%");
      const originalWidth = parseFloat(firstPage.style.width);

      zoomIn.click();
      await waitFor(() => zoomLevel.textContent === "110%");
      expect(parseFloat(firstPage.style.width)).toBeCloseTo(
        originalWidth * 1.1,
        5,
      );

      zoomOut.click();
      await waitFor(() => zoomLevel.textContent === "100%");
      expect(parseFloat(firstPage.style.width)).toBeCloseTo(originalWidth, 5);
    },
  );
});