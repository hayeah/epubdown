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
        const originalText = originalChapters[i].replace(/<[^>]*>/g, "").trim();
        const shortenedText = shortenedChapters[i]
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
