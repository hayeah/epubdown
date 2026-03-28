// Stub for fs/promises — @epubdown/core imports it but only uses it in Node CLIs
export async function readFile(): Promise<never> {
  throw new Error("fs/promises not available in browser");
}
