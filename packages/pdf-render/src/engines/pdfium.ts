import { init as initPdfium, type WrappedPdfiumModule } from "@embedpdf/pdfium";
import type {
  DocumentHandle,
  PageHandle,
  PageSizePt,
  PDFEngine,
} from "./types";

async function fetchWasmChecked(wasmUrl: string): Promise<ArrayBuffer> {
  const response = await fetch(wasmUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to load PDFium WASM from ${wasmUrl} (${response.status} ${response.statusText})`,
    );
  }
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (
    bytes.length < 4 ||
    bytes[0] !== 0x00 ||
    bytes[1] !== 0x61 ||
    bytes[2] !== 0x73 ||
    bytes[3] !== 0x6d
  ) {
    throw new Error(
      `Invalid PDFium WASM binary at ${wasmUrl}; expected magic word 00 61 73 6d.`,
    );
  }
  return buffer;
}

class PdfiumEngine implements PDFEngine {
  readonly name = "PDFium" as const;
  private instance: WrappedPdfiumModule | null = null;
  private core: any = null;

  async init({ wasmUrl = "/pdfium.wasm" } = {}) {
    if (this.instance) return;
    const buffer = await fetchWasmChecked(wasmUrl);
    const wrapper = await initPdfium({ wasmBinary: buffer });
    this.instance = wrapper;
    this.core = wrapper.pdfium || wrapper;
    if (typeof (this.instance as any).PDFiumExt_Init === "function") {
      (this.instance as any).PDFiumExt_Init();
    }
  }

  async loadDocument(data: Uint8Array): Promise<DocumentHandle> {
    this.ensureInit();
    const { core, instance } = this;

    const ptr = core.ccall?.("malloc", "number", ["number"], [data.length]);
    if (!ptr) throw new Error("malloc failed");
    (core.HEAPU8 as Uint8Array).set(data, ptr);
    const doc = core.ccall(
      "FPDF_LoadMemDocument",
      "number",
      ["number", "number", "number"],
      [ptr, data.length, 0],
    );
    if (!doc) {
      core.ccall?.("free", null, ["number"], [ptr]);
      throw new Error("FPDF_LoadMemDocument failed");
    }

    const pageCount = () => (instance as any).FPDF_GetPageCount(doc);

    const getPageSize = async (index0: number): Promise<PageSizePt> => {
      const page = (instance as any).FPDF_LoadPage(doc, index0);
      const wPt = (instance as any).FPDF_GetPageWidthF(page);
      const hPt = (instance as any).FPDF_GetPageHeightF(page);
      (instance as any).FPDF_ClosePage(page);
      return { wPt, hPt };
    };

    return {
      pageCount,
      getPageSize,
      async loadPage(index0): Promise<PageHandle> {
        const page = (instance as any).FPDF_LoadPage(doc, index0);
        const wPt = (instance as any).FPDF_GetPageWidthF(page);
        const hPt = (instance as any).FPDF_GetPageHeightF(page);
        return {
          async renderToCanvas(canvas, ppi) {
            const scale = (ppi ?? 96) / 72;
            const wPx = Math.max(1, Math.floor(wPt * scale));
            const hPx = Math.max(1, Math.floor(hPt * scale));
            const bmp = (instance as any).FPDFBitmap_Create(wPx, hPx, 0);
            (instance as any).FPDFBitmap_FillRect(
              bmp,
              0,
              0,
              wPx,
              hPx,
              0xffffffff,
            );
            (instance as any).FPDF_RenderPageBitmap(
              bmp,
              page,
              0,
              0,
              wPx,
              hPx,
              0,
              16,
            );
            const len = wPx * hPx * 4;
            const bufPtr = (instance as any).FPDFBitmap_GetBuffer(bmp);
            const heap = core.HEAPU8 as Uint8Array;
            canvas.width = wPx;
            canvas.height = hPx;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
              (instance as any).FPDFBitmap_Destroy(bmp);
              throw new Error("Canvas 2D context unavailable");
            }
            const img = ctx.createImageData(wPx, hPx);
            img.data.set(
              new Uint8ClampedArray(heap.buffer, heap.byteOffset + bufPtr, len),
            );
            ctx.putImageData(img, 0, 0);
            (instance as any).FPDFBitmap_Destroy(bmp);
          },
          destroy() {
            (instance as any).FPDF_ClosePage(page);
          },
        };
      },
      destroy() {
        (instance as any).FPDF_CloseDocument(doc);
        core.ccall?.("free", null, ["number"], [ptr]);
      },
    };
  }

  private ensureInit() {
    if (!this.instance || !this.core) {
      throw new Error("PDFium not initialized");
    }
  }
}

export function createPdfiumEngine(): PDFEngine {
  return new PdfiumEngine();
}
