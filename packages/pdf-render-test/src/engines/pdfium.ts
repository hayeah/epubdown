import type { WrappedPdfiumModule } from "@embedpdf/pdfium";
import { init as initPdfium } from "@embedpdf/pdfium";
import type { DocumentHandle, PDFEngine, PageHandle } from "../types.js";

let instance: WrappedPdfiumModule | null = null;
let pdfiumCore: any = null; // Store the actual PDFium core instance

export function createPdfiumEngine(wasmUrl = "/pdfium.wasm"): PDFEngine {
  return {
    name: "PDFium",
    async init() {
      if (instance) return;
      try {
        // Fetch the WASM binary
        const response = await fetch(wasmUrl);
        if (!response.ok) {
          throw new Error(
            `Failed to fetch WASM: ${response.status} ${response.statusText}`,
          );
        }
        const wasmBinary = await response.arrayBuffer();

        // Initialize PDFium with the WASM binary
        const wrapper = await initPdfium({ wasmBinary });
        instance = wrapper;

        // The wrapper might have a nested pdfium property or be the pdfium instance itself
        pdfiumCore = wrapper.pdfium || wrapper;

        // Initialize PDFium extension if available
        if (typeof instance.PDFiumExt_Init === "function") {
          instance.PDFiumExt_Init();
        } else if (typeof pdfiumCore.PDFiumExt_Init === "function") {
          pdfiumCore.PDFiumExt_Init();
        }

        console.log("PDFium initialized successfully");
      } catch (error) {
        console.error("Failed to initialize PDFium:", error);
        throw error;
      }
    },
    async loadDocument(data: Uint8Array): Promise<DocumentHandle> {
      if (!instance || !pdfiumCore)
        throw new Error("init() must be called first");

      let ptr: number | null = null;
      let doc: any = null;

      // Try different approaches based on what's available
      if (pdfiumCore.ccall) {
        // Approach 1: Using ccall (most reliable from reference)
        try {
          ptr = pdfiumCore.ccall("malloc", "number", ["number"], [data.length]);
          pdfiumCore.HEAPU8.set(data, ptr);
          doc = pdfiumCore.ccall(
            "FPDF_LoadMemDocument",
            "number",
            ["number", "number", "number"],
            [ptr, data.length, 0],
          );
        } catch (e) {
          console.log("ccall approach failed:", e);
        }
      }

      if (!doc && pdfiumCore._malloc && pdfiumCore.HEAPU8) {
        // Approach 2: Direct malloc approach
        try {
          ptr = pdfiumCore._malloc(data.length);
          if (ptr !== null) {
            pdfiumCore.HEAPU8.set(data, ptr);
            doc = instance.FPDF_LoadMemDocument(ptr, data.length, "");
          }
        } catch (e) {
          console.log("Direct malloc approach failed:", e);
        }
      }

      if (!doc) {
        // Approach 3: Try embedpdf wrapper's approach
        // The wrapper might handle memory internally
        try {
          doc = instance.FPDF_LoadMemDocument(data as any, data.length, "");
        } catch (e) {
          console.log("Wrapper approach failed:", e);
        }
      }

      if (!doc || doc === 0) {
        if (ptr && pdfiumCore._free) {
          pdfiumCore._free(ptr);
        }
        const errorCode = instance.FPDF_GetLastError
          ? instance.FPDF_GetLastError()
          : 3;
        const errorMessages: Record<number, string> = {
          0: "Success",
          1: "Unknown error",
          2: "File not found or could not be opened",
          3: "File not in PDF format or corrupted",
          4: "Password required or incorrect password",
          5: "Unsupported security scheme",
          6: "Page not found or content error",
        };
        throw new Error(
          `FPDF_LoadMemDocument failed with error: ${errorCode} (${errorMessages[errorCode] || "Unknown error"})`,
        );
      }

      return {
        pageCount: () => instance!.FPDF_GetPageCount(doc),
        async loadPage(pageIndex0): Promise<PageHandle> {
          if (!instance) throw new Error("Instance is null");
          const page = instance.FPDF_LoadPage(doc, pageIndex0);
          const wPt = instance.FPDF_GetPageWidthF(page);
          const hPt = instance.FPDF_GetPageHeightF(page);

          return {
            async renderToCanvas(canvas, ppi) {
              if (!instance) throw new Error("Instance is null");
              const scale = (ppi ?? 96) / 72;
              const wPx = Math.max(1, Math.floor(wPt * scale));
              const hPx = Math.max(1, Math.floor(hPt * scale));
              const bmp = instance.FPDFBitmap_Create(wPx, hPx, 0);
              instance.FPDFBitmap_FillRect(bmp, 0, 0, wPx, hPx, 0xffffffff);
              instance.FPDF_RenderPageBitmap(
                bmp,
                page,
                0,
                0,
                wPx,
                hPx,
                0,
                /*FPDF_REVERSE_BYTE_ORDER*/ 16,
              );

              const len = wPx * hPx * 4;
              const bufPtr = instance.FPDFBitmap_GetBuffer(bmp);

              // Get the heap from pdfiumCore
              const heap = pdfiumCore.HEAPU8;
              if (!heap) {
                throw new Error("HEAPU8 not found for bitmap buffer");
              }

              // PDFium uses BGRA format, need to convert to RGBA
              const buffer = new Uint8Array(
                heap.buffer,
                heap.byteOffset + bufPtr,
                len,
              );
              const rgba = new Uint8ClampedArray(len);

              // Convert BGRA to RGBA
              for (let i = 0; i < len; i += 4) {
                rgba[i] = buffer[i + 2]!; // R
                rgba[i + 1] = buffer[i + 1]!; // G
                rgba[i + 2] = buffer[i]!; // B
                rgba[i + 3] = buffer[i + 3]!; // A
              }

              canvas.width = wPx;
              canvas.height = hPx;
              const ctx = canvas.getContext("2d");
              if (!ctx) throw new Error("Failed to get 2d context");
              ctx.putImageData(new ImageData(rgba, wPx, hPx), 0, 0);

              instance.FPDFBitmap_Destroy(bmp);
            },
            destroy() {
              if (!instance) return;
              instance.FPDF_ClosePage(page);
            },
          };
        },
        destroy() {
          if (!instance) return;
          instance.FPDF_CloseDocument(doc);
          if (ptr && pdfiumCore._free) {
            pdfiumCore._free(ptr);
          }
        },
      };
    },
  };
}
