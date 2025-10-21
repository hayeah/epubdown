import type { WrappedPdfiumModule } from "@embedpdf/pdfium";
import { init as initPdfium } from "@embedpdf/pdfium";
import type { DocumentHandle, PDFEngine, PageHandle } from "../types.js";

let instance: WrappedPdfiumModule | null = null;
let pdfiumCore: any = null; // Store the actual PDFium core instance

export interface PdfiumEngineOptions {
  wasmUrl?: string;
}

export function createPdfiumEngine(
  options: PdfiumEngineOptions | string = {},
): PDFEngine {
  // Support legacy string parameter for wasmUrl
  const opts = typeof options === "string" ? { wasmUrl: options } : options;
  const { wasmUrl = "/pdfium.wasm" } = opts;

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
      let allocMethod: "ccall" | "direct" | "wrapper" | null = null;

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
          allocMethod = "ccall";
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
            allocMethod = "direct";
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
          allocMethod = "wrapper";
          ptr = null; // Wrapper manages memory internally
        } catch (e) {
          console.log("Wrapper approach failed:", e);
        }
      }

      if (!doc || doc === 0) {
        // Free memory using the same method that allocated it
        if (ptr !== null) {
          if (allocMethod === "ccall" && pdfiumCore.ccall) {
            pdfiumCore.ccall("free", null, ["number"], [ptr]);
          } else if (allocMethod === "direct" && pdfiumCore._free) {
            pdfiumCore._free(ptr);
          }
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
          const totalPages = instance.FPDF_GetPageCount(doc);
          if (pageIndex0 < 0 || pageIndex0 >= totalPages) {
            throw new Error(
              `Invalid page index ${pageIndex0}. Document has ${totalPages} pages (valid range: 0-${totalPages - 1})`,
            );
          }
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

              canvas.width = wPx;
              canvas.height = hPx;
              const ctx = canvas.getContext("2d");
              if (!ctx) throw new Error("Failed to get 2d context");

              // Note: FPDF_REVERSE_BYTE_ORDER (flag 16) converts from BGRA to RGBA
              // Create direct Uint8ClampedArray view from WASM heap and copy to ImageData
              const imgData = ctx.createImageData(wPx, hPx);
              const sourceView = new Uint8ClampedArray(
                heap.buffer,
                heap.byteOffset + bufPtr,
                len,
              );
              imgData.data.set(sourceView);

              ctx.putImageData(imgData, 0, 0);

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
          // Free memory using the same method that allocated it
          if (ptr !== null) {
            if (allocMethod === "ccall" && pdfiumCore.ccall) {
              pdfiumCore.ccall("free", null, ["number"], [ptr]);
            } else if (allocMethod === "direct" && pdfiumCore._free) {
              pdfiumCore._free(ptr);
            }
          }
        },
      };
    },
  };
}
