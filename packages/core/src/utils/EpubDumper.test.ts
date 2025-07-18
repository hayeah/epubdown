import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fetchEpub } from "../testUtils";
import { EpubDumper } from "./EpubDumper";
import { unzip } from "./zipUtils";

describe("EpubDumper", () => {
  let testDir: string;

  beforeEach(async () => {
    // Create a temporary test directory
    testDir = await fs.mkdtemp(join(tmpdir(), "epub-dumper-test-"));
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (e) {
      // Directory might already be removed
    }
  });

  describe("fromDirectory", () => {
    it("should create dumper from directory and dump files", async () => {
      // Load and extract Alice EPUB to temp directory
      const epubData = await fetchEpub("alice.epub");
      await unzip(epubData, testDir);

      // Create dumper and run dump
      const dumper = await EpubDumper.fromDirectory(testDir);
      await dumper.dump();

      // Check that metadata files were created in root
      const metadataPath = join(testDir, "metadata.dump.json");
      expect(
        await fs
          .access(metadataPath)
          .then(() => true)
          .catch(() => false),
      ).toBe(true);

      const metadata = JSON.parse(await fs.readFile(metadataPath, "utf8"));
      expect(metadata.title).toBe("Alice's Adventures in Wonderland");
      expect(metadata.author).toBe("Lewis Carroll");

      // Check that manifest was created
      const manifestPath = join(testDir, "manifest.dump.json");
      expect(
        await fs
          .access(manifestPath)
          .then(() => true)
          .catch(() => false),
      ).toBe(true);

      // Check that chapters list was created
      const chaptersPath = join(testDir, "chapters.dump.json");
      expect(
        await fs
          .access(chaptersPath)
          .then(() => true)
          .catch(() => false),
      ).toBe(true);

      const chapters = JSON.parse(await fs.readFile(chaptersPath, "utf8"));
      expect(chapters.length).toBeGreaterThan(0);
      expect(chapters[0]).toHaveProperty("index");
      expect(chapters[0]).toHaveProperty("title");
      expect(chapters[0]).toHaveProperty("path");

      // Check that at least one chapter markdown was created
      const firstChapter = chapters[0];
      const chapterMdPath = firstChapter.path.replace(
        /\.(x?html?)$/i,
        ".dump.md",
      );
      const fullChapterMdPath = join(testDir, chapterMdPath);
      expect(
        await fs
          .access(fullChapterMdPath)
          .then(() => true)
          .catch(() => false),
      ).toBe(true);
    });
  });

  describe("fromZip", () => {
    it("should create dumper from zip file", async () => {
      // Load Alice EPUB
      const epubData = await fetchEpub("alice.epub");

      // Create dumper from zip
      const dumper = await EpubDumper.fromZip(epubData);
      await dumper.dump();

      // The dumper should have created a temp directory
      // We can't check the exact path, but we can verify the dump worked
      // by checking that cleanup removes the temp directory
      await dumper.cleanup();
    });
  });

  describe("cleanup", () => {
    it("should not remove non-temp directories", async () => {
      // Create a non-temp directory for this test
      const nonTempDir = join(process.cwd(), "test-epub-dump");
      await fs.mkdir(nonTempDir, { recursive: true });

      try {
        // Load and extract Alice EPUB to non-temp directory
        const epubData = await fetchEpub("alice.epub");
        await unzip(epubData, nonTempDir);

        const dumper = await EpubDumper.fromDirectory(nonTempDir);
        await dumper.dump();

        // Verify some files were created
        const metadataPath = join(nonTempDir, "metadata.dump.json");
        expect(
          await fs
            .access(metadataPath)
            .then(() => true)
            .catch(() => false),
        ).toBe(true);

        await dumper.cleanup();

        // Directory and files should still exist after cleanup
        expect(
          await fs
            .access(nonTempDir)
            .then(() => true)
            .catch(() => false),
        ).toBe(true);
        expect(
          await fs
            .access(metadataPath)
            .then(() => true)
            .catch(() => false),
        ).toBe(true);
      } finally {
        // Clean up the non-temp directory
        await fs.rm(nonTempDir, { recursive: true, force: true });
      }
    });

    it("should remove temp directories created from zip", async () => {
      // Load Alice EPUB
      const epubData = await fetchEpub("alice.epub");

      // Create dumper from zip (which creates temp directory)
      const dumper = await EpubDumper.fromZip(epubData);

      // Get the temp directory path (we'll need to access private property for testing)
      const tempDirPath = (dumper as any).baseDir;

      // Verify it's in tmpdir
      expect(tempDirPath).toContain(tmpdir());

      await dumper.dump();

      // Verify temp directory exists
      expect(
        await fs
          .access(tempDirPath)
          .then(() => true)
          .catch(() => false),
      ).toBe(true);

      await dumper.cleanup();

      // Temp directory should be removed
      expect(
        await fs
          .access(tempDirPath)
          .then(() => true)
          .catch(() => false),
      ).toBe(false);
    });
  });
});
