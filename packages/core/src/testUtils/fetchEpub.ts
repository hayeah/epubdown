import { promises as fs } from "node:fs";
import { resolve } from "node:path";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const epubPaths = {
  "alice.epub": resolve(
    __dirname,
    "../../../../epubs/Alice's Adventures in Wonderland.epub",
  ),
  "modest.epub": resolve(__dirname, "../../../../epubs/A Modest Proposal.epub"),
};

export async function fetchEpub(name: keyof typeof epubPaths): Promise<Buffer> {
  const path = epubPaths[name];
  if (!path) {
    throw new Error(`Unknown EPUB: ${name}`);
  }

  return await fs.readFile(path);
}
