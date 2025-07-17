import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import JSZip from "jszip";
import { EPub, FileDataResolver } from "../Epub";
import { XmlAnonymizer } from "./anonymizeXml";

interface ShortenOptions {
  preserveLength?: boolean;
  format?: boolean;
}

export async function shortenDir(
  dir: string,
  opts: ShortenOptions = {}
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
  opts: ShortenOptions = {}
): Promise<Uint8Array> {
  // Create temp directory
  const tempDir = await fs.mkdtemp(join(tmpdir(), "epub-shorten-"));

  try {
    // Unzip EPUB to temp directory
    const zip = await JSZip.loadAsync(zipData);

    // Extract all files
    for (const [relativePath, file] of Object.entries(zip.files)) {
      if (!file.dir) {
        const filePath = join(tempDir, relativePath);
        await fs.mkdir(dirname(filePath), { recursive: true });
        const content = await file.async("uint8array");
        await fs.writeFile(filePath, content);
      }
    }

    // Shorten content in place
    await shortenDir(tempDir, opts);

    // Zip everything back up
    const newZip = new JSZip();

    // Add all files from temp directory back to zip
    async function addFilesToZip(dir: string, zipPath = "") {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        const zipFilePath = zipPath ? join(zipPath, entry.name) : entry.name;

        if (entry.isDirectory()) {
          await addFilesToZip(fullPath, zipFilePath);
        } else {
          const content = await fs.readFile(fullPath);
          newZip.file(zipFilePath, content);
        }
      }
    }

    await addFilesToZip(tempDir);

    // Generate final zip
    return await newZip.generateAsync({ type: "uint8array" });
  } finally {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}
