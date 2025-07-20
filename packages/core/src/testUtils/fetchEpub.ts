// EPUB path mappings
const epubPaths = {
  "alice.epub": "Alice's Adventures in Wonderland.epub",
  "modest.epub": "A Modest Proposal.epub",
};

type FetchEpubFunction = (name: keyof typeof epubPaths) => Promise<Uint8Array>;

let fetchEpub: FetchEpubFunction;

// Use Vite's import.meta.SSR for conditional bundling
// @ts-ignore - import.meta.SSR is defined by Vite
if (import.meta.SSR ?? typeof window === "undefined") {
  // Server-side: Use node:fs
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");

  const __filename = url.fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  fetchEpub = async (name: keyof typeof epubPaths): Promise<Uint8Array> => {
    const filename = epubPaths[name];
    if (!filename) {
      throw new Error(`Unknown EPUB: ${name}`);
    }

    const filePath = path.resolve(__dirname, "../../../../epubs", filename);
    const buffer = await fs.promises.readFile(filePath);
    // Buffer extends Uint8Array in Node.js
    return buffer;
  };
} else {
  // Client-side: Use fetch
  fetchEpub = async (name: keyof typeof epubPaths): Promise<Uint8Array> => {
    const filename = epubPaths[name];
    if (!filename) {
      throw new Error(`Unknown EPUB: ${name}`);
    }

    const url = `/${filename}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  };
}

export { fetchEpub };
