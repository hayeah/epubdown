import { promises as fs } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fetchEpub } from "../testUtils";
import { EpubDumper } from "./EpubDumper";
import { unzip } from "./zipUtils";

describe("EpubDumper", () => {
  let testDir: string;

  beforeEach(async () => {
    // Create a temporary test directory
    testDir = join(process.cwd(), "epub-dumper-test-" + Date.now());
    await fs.mkdir(testDir, { recursive: true });
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

  describe("fromZipFile", () => {
    it("should create dumper from zip file", async () => {
      // Create a temp EPUB file
      const epubData = await fetchEpub("alice.epub");
      const tempEpubPath = join(process.cwd(), "test-alice.epub");
      await fs.writeFile(tempEpubPath, epubData);

      try {
        // Create dumper from zip file
        const dumper = await EpubDumper.fromZipFile(tempEpubPath);
        await dumper.dump();

        // Verify the dump directory was created
        const dumpDir = "test-alice_dump";
        expect(
          await fs
            .access(dumpDir)
            .then(() => true)
            .catch(() => false),
        ).toBe(true);

        // Clean up
        await fs.rm(dumpDir, { recursive: true, force: true });
      } finally {
        // Clean up temp EPUB file
        await fs.rm(tempEpubPath, { force: true });
      }
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

        // Cleanup method no longer exists - directories are not cleaned up automatically
        // Directory and files should still exist
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

    it("should not create temp directories with fromZipFile", async () => {
      // Create a temp EPUB file
      const epubData = await fetchEpub("alice.epub");
      const tempEpubPath = join(process.cwd(), "test-alice-cleanup.epub");
      await fs.writeFile(tempEpubPath, epubData);

      try {
        // Create dumper from zip file
        const dumper = await EpubDumper.fromZipFile(tempEpubPath);
        const dumpDir = "test-alice-cleanup_dump";

        // Verify the dump directory was created in current directory, not temp
        expect(
          await fs
            .access(dumpDir)
            .then(() => true)
            .catch(() => false),
        ).toBe(true);

        // Clean up manually since no cleanup method exists
        await fs.rm(dumpDir, { recursive: true, force: true });
      } finally {
        // Clean up temp EPUB file
        await fs.rm(tempEpubPath, { force: true });
      }
    });
  });
});
