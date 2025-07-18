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

  async shortenZip(zipData: Uint8Array | Buffer): Promise<Uint8Array> {
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

  async shortenZipFile(filePath: string): Promise<Uint8Array> {
    const zipData = await fs.readFile(filePath);
    return this.shortenZip(zipData);
  }

  async shorten(
    input: string | Uint8Array | Buffer,
  ): Promise<Uint8Array | undefined> {
    // If input is binary data (Uint8Array or Buffer)
    if (input instanceof Uint8Array || Buffer.isBuffer(input)) {
      return this.shortenZip(input);
    }

    // If input is a string, check if it's a directory or file
    if (typeof input === "string") {
      const stats = await fs.stat(input);

      if (stats.isDirectory()) {
        await this.shortenDir(input);
        return;
      }
      if (stats.isFile()) {
        return this.shortenZipFile(input);
      }

      throw new Error(`Invalid input path: ${input}`);
    }

    throw new Error("Invalid input type");
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
  return shortener.shortenZip(zipData);
}
