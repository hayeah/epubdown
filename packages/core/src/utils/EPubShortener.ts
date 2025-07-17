import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EPub, FileDataResolver } from "../Epub";
import { XmlAnonymizer } from "./anonymizeXml";
import { unzip, zipToBuffer } from "./zipUtils";

interface ShortenOptions {
  preserveLength?: boolean;
  format?: boolean;
}

export async function shortenDir(
  dir: string,
  opts: ShortenOptions = {},
): Promise<void> {
  const epub = await EPub.init(new FileDataResolver(dir));

  // Only process content chapters, not metadata files
  for await (const chapter of epub.getChapters()) {
    const mode = chapter.name.endsWith(".html") ? "html" : "xml";
    // Create a fresh anonymizer instance for each chapter
    const anonymizer = new XmlAnonymizer({ mode, ...opts });
    const shortened = await anonymizer.anonymize(chapter.content);
    await fs.writeFile(join(chapter.base, chapter.name), shortened);
  }
}

export async function shorten(
  zipData: Uint8Array | Buffer,
  opts: ShortenOptions = {},
): Promise<Uint8Array> {
  // Create temp directory
  const tempDir = await fs.mkdtemp(join(tmpdir(), "epub-shorten-"));

  try {
    // Unzip EPUB to temp directory
    await unzip(zipData, tempDir);

    // Shorten content in place
    await shortenDir(tempDir, opts);

    // Zip everything back up
    return await zipToBuffer(tempDir);
  } finally {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}
