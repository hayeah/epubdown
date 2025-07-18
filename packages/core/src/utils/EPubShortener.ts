import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EPub, FileDataResolver } from "../Epub";
import { XmlAnonymizer } from "./anonymizeXml";
import type { XmlAnonymizerOptions } from "./anonymizeXml";
import { unzip, zipToBuffer } from "./zipUtils";

export class EPubShortener {
  constructor(
    private readonly options: Omit<
      XmlAnonymizerOptions,
      "mode" | "basePath"
    > = {},
  ) {}

  async shortenDir(dir: string): Promise<void> {
    const epub = await EPub.init(new FileDataResolver(dir));
    const imagePathsToDelete = new Map<string, string>(); // Map of image path to base directory

    // Process each chapter
    for await (const chapter of epub.getChapters()) {
      const mode = chapter.name.endsWith(".html") ? "html" : "xml";
      const anonymizer = new XmlAnonymizer({
        mode,
        ...this.options,
        basePath: chapter.base,
      });

      const shortened = await anonymizer.anonymize(chapter.content);
      await fs.writeFile(join(chapter.base, chapter.name), shortened);

      // Collect image paths with their base directory
      if (this.options.stripImages) {
        for (const path of anonymizer.getStrippedImagePaths()) {
          imagePathsToDelete.set(path, chapter.base);
        }
      }
    }

    // Delete image files if stripImages is enabled
    if (this.options.stripImages) {
      for (const [imagePath, basePath] of imagePathsToDelete) {
        // Construct the full path using the base directory where the image was referenced
        const fullPath = join(basePath, imagePath);
        try {
          await fs.unlink(fullPath);
        } catch (err) {
          // Ignore errors if file doesn't exist
        }
      }
    }
  }

  async shorten(zipData: Uint8Array | Buffer): Promise<Uint8Array> {
    // Create temp directory
    const tempDir = await fs.mkdtemp(join(tmpdir(), "epub-shorten-"));

    try {
      // Unzip EPUB to temp directory
      await unzip(zipData, tempDir);

      // Shorten content in place
      await this.shortenDir(tempDir);

      // Zip everything back up
      return await zipToBuffer(tempDir);
    } finally {
      // Clean up temp directory
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }
}

// Backward compatibility functions
export async function shortenDir(
  dir: string,
  opts: Omit<XmlAnonymizerOptions, "mode" | "basePath"> = {},
): Promise<void> {
  const shortener = new EPubShortener(opts);
  return shortener.shortenDir(dir);
}

export async function shorten(
  zipData: Uint8Array | Buffer,
  opts: Omit<XmlAnonymizerOptions, "mode" | "basePath"> = {},
): Promise<Uint8Array> {
  const shortener = new EPubShortener(opts);
  return shortener.shorten(zipData);
}
