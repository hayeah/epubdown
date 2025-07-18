import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EPub, FileDataResolver } from "../Epub";
import { fetchEpub } from "../testUtils";
import { parseHtml } from "../xmlParser";
import { shorten, shortenDir } from "./EPubShortener";
import { unzip } from "./zipUtils";

describe("EPubShortener", () => {
  let tempDir: string;

  beforeEach(async () => {
    // Create a temporary directory for tests
    tempDir = await fs.mkdtemp(join(tmpdir(), "epub-shorten-test-"));
  });

  afterEach(async () => {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("shortenDir", () => {
    it("should shorten all chapters in an extracted EPUB directory", async () => {
      // Load and extract Alice EPUB to temp directory
      const epubData = await fetchEpub("alice.epub");

      // Extract all files using the helper
      await unzip(epubData, tempDir);

      // Run the shortener on the directory
      await shortenDir(tempDir, { preserveLength: true });

      // Verify that chapters have been shortened
      const epub = await EPub.init(new FileDataResolver(tempDir));
      let chaptersChecked = 0;

      for await (const chapter of epub.getChapters()) {
        // Check that text content has been replaced with public domain text
        // The text should be from Moby Dick but may not start at the beginning
        const publicDomainText =
          "Call me Ishmael. Some years ago—never mind how long precisely—having little or no money in my purse, and nothing particular to interest me on shore, I thought I would sail about a little and see the watery part of the world.";

        // Parse the chapter content to check text nodes
        const doc = parseHtml(chapter.content);
        const textContent = doc.body?.textContent?.trim() || "";

        if (textContent.length > 15) {
          // Check that the text is part of the public domain text
          const first15 = textContent.slice(0, 15);
          expect(publicDomainText).toContain(first15);
        }

        chaptersChecked++;
      }

      expect(chaptersChecked).toBeGreaterThan(0);
    });

    it("should strip images when stripImages option is enabled", async () => {
      // Create a test EPUB structure with images
      const oebpsDir = join(tempDir, "OEBPS");
      await fs.mkdir(oebpsDir, { recursive: true });
      
      // Create container.xml
      const metaInfDir = join(tempDir, "META-INF");
      await fs.mkdir(metaInfDir, { recursive: true });
      await fs.writeFile(
        join(metaInfDir, "container.xml"),
        `<?xml version="1.0" encoding="UTF-8"?>
<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
      );
      
      // Create content.opf
      await fs.writeFile(
        join(oebpsDir, "content.opf"),
        `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Test Book</dc:title>
    <dc:identifier id="BookId">test123</dc:identifier>
  </metadata>
  <manifest>
    <item id="chapter1" href="chapter1.html" media-type="application/xhtml+xml"/>
    <item id="chapter2" href="chapter2.xml" media-type="application/xhtml+xml"/>
    <item id="image1" href="images/test.png" media-type="image/png"/>
  </manifest>
  <spine>
    <itemref idref="chapter1"/>
    <itemref idref="chapter2"/>
  </spine>
</package>`
      );
      
      // Create HTML chapter with img tag
      await fs.writeFile(
        join(oebpsDir, "chapter1.html"),
        `<!DOCTYPE html>
<html>
<body>
<h1>Chapter 1</h1>
<p>Here is an image: <img src="images/test.png" alt="Test image"/></p>
<p>Some text after the image.</p>
</body>
</html>`
      );
      
      // Create XML chapter with SVG image
      await fs.writeFile(
        join(oebpsDir, "chapter2.xml"),
        `<?xml version="1.0" encoding="UTF-8"?>
<chapter>
<title>Chapter 2</title>
<svg xmlns="http://www.w3.org/2000/svg">
<image xlink:href="images/test.png" x="0" y="0" width="100" height="100"/>
</svg>
</chapter>`
      );
      
      // Create image directory and file
      const imagesDir = join(oebpsDir, "images");
      await fs.mkdir(imagesDir, { recursive: true });
      await fs.writeFile(join(imagesDir, "test.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));

      // Run the shortener with stripImages enabled
      await shortenDir(tempDir, { stripImages: true });

      // Verify that image file has been deleted
      const imageExists = await fs.access(join(imagesDir, "test.png")).then(() => true).catch(() => false);
      expect(imageExists).toBe(false);

      // Verify that img tags have been replaced with [image src: ...] text
      const chapter1Content = await fs.readFile(join(oebpsDir, "chapter1.html"), "utf-8");
      expect(chapter1Content).toContain("[image src: images/test.png]");
      expect(chapter1Content).not.toContain("<img");
      
      const chapter2Content = await fs.readFile(join(oebpsDir, "chapter2.xml"), "utf-8");
      expect(chapter2Content).toContain("[image src: images/test.png]");
      expect(chapter2Content).not.toContain("<image");
    });
  });

  describe("shorten", () => {
    it("should create a shortened EPUB file", async () => {
      // Load Alice EPUB
      const epubData = await fetchEpub("alice.epub");

      // Shorten the EPUB
      const shortenedData = await shorten(epubData, {
        preserveLength: true,
      });

      // Verify the result is a valid EPUB
      expect(shortenedData).toBeInstanceOf(Uint8Array);
      expect(shortenedData.length).toBeGreaterThan(0);

      // Load the shortened EPUB and verify content
      const epub = await EPub.fromZip(shortenedData);
      const metadata = epub.getMetadata();
      expect(metadata.title).toBe("Alice's Adventures in Wonderland");

      // Check that chapters have been shortened
      let chaptersChecked = 0;
      const publicDomainText =
        "Call me Ishmael. Some years ago—never mind how long precisely—having little or no money in my purse, and nothing particular to interest me on shore, I thought I would sail about a little and see the watery part of the world.";

      for await (const chapter of epub.getChapters()) {
        // The content should have public domain text
        const contentWithoutTags = chapter.content
          .replace(/<[^>]*>/g, "")
          .trim();
        if (contentWithoutTags.length > 15) {
          // Each chapter starts with a fresh anonymizer, so should start with "Call me Ishmael"
          expect(contentWithoutTags.slice(0, 15)).toBe("Call me Ishmael");
        }
        chaptersChecked++;
      }

      expect(chaptersChecked).toBeGreaterThan(0);
    });

    it("should respect the preserveLength option", async () => {
      // Load modest proposal EPUB
      const epubData = await fetchEpub("modest.epub");

      // Shorten without preserving length
      const shortenedData = await shorten(epubData, {
        preserveLength: false,
      });

      // Load both original and shortened EPUBs
      const originalEpub = await EPub.fromZip(epubData);
      const shortenedEpub = await EPub.fromZip(shortenedData);

      // Compare chapter lengths
      const originalChapters = [];
      for await (const chapter of originalEpub.getChapters()) {
        originalChapters.push(chapter.content);
      }

      const shortenedChapters = [];
      for await (const chapter of shortenedEpub.getChapters()) {
        shortenedChapters.push(chapter.content);
      }

      expect(originalChapters.length).toBe(shortenedChapters.length);

      // When preserveLength is false, the content lengths will likely differ
      for (let i = 0; i < originalChapters.length; i++) {
        const originalText = originalChapters[i]!.replace(/<[^>]*>/g, "").trim();
        const shortenedText = shortenedChapters[i]!
          .replace(/<[^>]*>/g, "")
          .trim();

        // Content should be anonymized (different)
        if (originalText.length > 50) {
          expect(shortenedText).not.toBe(originalText);
        }
      }
    });
  });
});
