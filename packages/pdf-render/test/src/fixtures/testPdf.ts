/**
 * A minimal valid PDF with 3 pages for testing
 * Generated programmatically to be as small as possible
 */

// Minimal PDF with 3 pages - each page is 612x792 (US Letter size)
const SIMPLE_PDF_BASE64 =
  "JVBERi0xLjQKJeLjz9MKCjEgMCBvYmoKPDwKL1R5cGUgL0NhdGFsb2cKL1BhZ2VzIDIgMCBSCj4+CmVuZG9iagoKMiAwIG9iago8PAovVHlwZSAvUGFnZXMKL0tpZHMgWzMgMCBSIDQgMCBSIDUgMCBSXQovQ291bnQgMwo+PgplbmRvYmoKCjMgMCBvYmoKPDwKL1R5cGUgL1BhZ2UKL1BhcmVudCAyIDAgUgovTWVkaWFCb3ggWzAgMCA2MTIgNzkyXQovQ29udGVudHMgNiAwIFIKL1Jlc291cmNlcyA8PAovRm9udCA8PAovRjEgOCAwIFIKPj4KPj4KPj4KZW5kb2JqCgo0IDAgb2JqCjw8Ci9UeXBlIC9QYWdlCi9QYXJlbnQgMiAwIFIKL01lZGlhQm94IFswIDAgNjEyIDc5Ml0KL0NvbnRlbnRzIDcgMCBSCi9SZXNvdXJjZXMgPDwKL0ZvbnQgPDwKL0YxIDggMCBSCj4+Cj4+Cj4+CmVuZG9iagoKNSAwIG9iago8PAovVHlwZSAvUGFnZQovUGFyZW50IDIgMCBSCi9NZWRpYUJveCBbMCAwIDYxMiA3OTJdCi9Db250ZW50cyA5IDAgUgovUmVzb3VyY2VzIDw8Ci9Gb250IDw8Ci9GMSA4IDAgUgo+Pgo+Pgo+PgplbmRvYmoKCjYgMCBvYmoKPDwKL0xlbmd0aCA0NAo+PgpzdHJlYW0KQlQKL0YxIDI0IFRmCjUwIDcwMCBUZAooUGFnZSAxKSBUagpFVAplbmRzdHJlYW0KZW5kb2JqCgo3IDAgb2JqCjw8Ci9MZW5ndGggNDQKPj4Kc3RyZWFtCkJUCi9GMSAyNCBUZgo1MCA3MDAgVGQKKFBhZ2UgMikgVGoKRVQKZW5kc3RyZWFtCmVuZG9iagoKOSAwIG9iago8PAovTGVuZ3RoIDQ0Cj4+CnN0cmVhbQpCVAovRjEgMjQgVGYKNTAgNzAwIFRkCihQYWdlIDMpIFRqCkVUCmVuZHN0cmVhbQplbmRvYmoKCjggMCBvYmoKPDwKL1R5cGUgL0ZvbnQKL1N1YnR5cGUgL1R5cGUxCi9CYXNlRm9udCAvSGVsdmV0aWNhCj4+CmVuZG9iagoKeHJlZgowIDEwCjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAxNSAwMDAwMCBuIAowMDAwMDAwMDY0IDAwMDAwIG4gCjAwMDAwMDAxMzEgMDAwMDAgbiAKMDAwMDAwMDI2OSAwMDAwMCBuIAowMDAwMDAwNDA3IDAwMDAwIG4gCjAwMDAwMDA1NDUgMDAwMDAgbiAKMDAwMDAwMDYzOCAwMDAwMCBuIAowMDAwMDAwNzMxIDAwMDAwIG4gCjAwMDAwMDA4MTQgMDAwMDAgbiAKdHJhaWxlcgo8PAovU2l6ZSAxMAovUm9vdCAxIDAgUgo+PgpzdGFydHhyZWYKOTA3CiUlRU9GCg==";

/**
 * Default path for external test PDF files
 * Can be overridden with TEST_BOOKS_DIR environment variable
 */
const DEFAULT_TEST_BOOKS_DIR = "packages/pdf-render/test/src/test_pdfs";
const DEFAULT_TEST_PDF = "test.pdf";

/**
 * Get the test books directory from environment variable or use default
 */
function getTestBooksDir(): string {
  // @ts-expect-error - import.meta.env may not have TEST_BOOKS_DIR at compile time
  return import.meta.env?.TEST_BOOKS_DIR || DEFAULT_TEST_BOOKS_DIR;
}

/**
 * Returns a simple 3-page test PDF as Uint8Array
 * Falls back to embedded base64 PDF if file loading fails
 */
export async function getSimpleTestPdf(): Promise<Uint8Array> {
  // Try to load from external file first
  try {
    const testDir = getTestBooksDir();
    const testPath = `/${testDir}/${DEFAULT_TEST_PDF}`;

    const response = await fetch(testPath);
    if (response.ok) {
      const arrayBuffer = await response.arrayBuffer();
      return new Uint8Array(arrayBuffer);
    }
  } catch (error) {
    // Fall through to embedded PDF
    console.debug("Could not load external test PDF, using embedded version:", error);
  }

  // Fall back to embedded base64 PDF
  const binaryString = atob(SIMPLE_PDF_BASE64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * For Node.js environments
 * Note: This will always use the embedded PDF in Node.js since fetch may not be available
 */
export function getSimpleTestPdfNode(): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(SIMPLE_PDF_BASE64, "base64"));
  }
  // Fall back to decoding base64 manually
  const binaryString = atob(SIMPLE_PDF_BASE64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
