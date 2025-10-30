import "@embedpdf/pdfium";

declare module "@embedpdf/pdfium" {
  interface PdfiumModule {
    HEAPU8?: Uint8Array;
    wasmBinary?: ArrayBuffer;
  }
}
