import type { EPub, XMLFile } from "@epubdown/core";
import { runInAction } from "mobx";
import { beforeEach, describe, expect, it } from "vitest";
import { RootStore } from "./RootStore";

describe("MobX Store Integration - Simple", () => {
  let rootStore: RootStore;

  beforeEach(() => {
    rootStore = new RootStore();
  });

  describe("Basic store functionality", () => {
    it("should initialize with empty state", () => {
      expect(rootStore.epubStore.epub).toBeNull();
      expect(rootStore.epubStore.chapters).toHaveLength(0);
      expect(rootStore.epubStore.currentChapterIndex).toBe(0);
      expect(rootStore.chapterStore.cachedChapterCount).toBe(0);
      expect(rootStore.resourceStore.images.size).toBe(0);
      expect(rootStore.resourceStore.footnotes.size).toBe(0);
    });

    it("should handle chapter navigation", () => {
      // Create mock chapters
      const mockChapters = [
        { path: "ch1.xhtml" },
        { path: "ch2.xhtml" },
        { path: "ch3.xhtml" },
      ] as XMLFile[];

      runInAction(() => {
        rootStore.epubStore.chapters = mockChapters;
      });

      // Test navigation
      expect(rootStore.epubStore.currentChapterIndex).toBe(0);
      expect(rootStore.epubStore.currentChapter).toStrictEqual(mockChapters[0]);

      // Next chapter
      rootStore.epubStore.nextChapter();
      expect(rootStore.epubStore.currentChapterIndex).toBe(1);
      expect(rootStore.epubStore.currentChapter).toStrictEqual(mockChapters[1]);

      // Previous chapter
      rootStore.epubStore.previousChapter();
      expect(rootStore.epubStore.currentChapterIndex).toBe(0);

      // Set specific chapter
      rootStore.epubStore.setCurrentChapter(2);
      expect(rootStore.epubStore.currentChapterIndex).toBe(2);
      expect(rootStore.epubStore.currentChapter).toStrictEqual(mockChapters[2]);

      // Should not go beyond bounds
      rootStore.epubStore.nextChapter();
      expect(rootStore.epubStore.currentChapterIndex).toBe(2);

      rootStore.epubStore.setCurrentChapter(0);
      rootStore.epubStore.previousChapter();
      expect(rootStore.epubStore.currentChapterIndex).toBe(0);
    });

    it("should track chapter loading state", () => {
      const testPath = "test/chapter.xhtml";

      // Initially not loading
      expect(rootStore.chapterStore.isChapterLoading(testPath)).toBe(false);

      // Mark as loading
      runInAction(() => {
        rootStore.chapterStore.loadingChapters.add(testPath);
      });
      expect(rootStore.chapterStore.isChapterLoading(testPath)).toBe(true);

      // Mark as loaded
      runInAction(() => {
        rootStore.chapterStore.loadingChapters.delete(testPath);
        rootStore.chapterStore.markdownResults.set(testPath, {
          markdown: "# Test",
          reactTree: null,
        });
      });
      expect(rootStore.chapterStore.isChapterLoading(testPath)).toBe(false);
      expect(rootStore.chapterStore.getChapterResult(testPath)).toBeTruthy();
      expect(rootStore.chapterStore.cachedChapterCount).toBe(1);
    });

    it("should track resource loading state", () => {
      const mockXMLFile = { path: "test.xhtml" } as XMLFile;
      const imageHref = "image.jpg";
      const key = `${mockXMLFile.path}:${imageHref}`;

      // Initially not loading
      expect(rootStore.resourceStore.isLoading(mockXMLFile, imageHref)).toBe(
        false,
      );

      // Mark as loading
      runInAction(() => {
        rootStore.resourceStore.loadingResources.add(key);
      });
      expect(rootStore.resourceStore.isLoading(mockXMLFile, imageHref)).toBe(
        true,
      );

      // Mark as loaded
      runInAction(() => {
        rootStore.resourceStore.loadingResources.delete(key);
        rootStore.resourceStore.images.set(key, "data:image/jpeg;base64,test");
      });
      expect(rootStore.resourceStore.isLoading(mockXMLFile, imageHref)).toBe(
        false,
      );
      expect(rootStore.resourceStore.getImage(mockXMLFile, imageHref)).toBe(
        "data:image/jpeg;base64,test",
      );
    });

    it("should handle errors properly", () => {
      const testPath = "error/chapter.xhtml";
      const errorMessage = "Failed to load chapter";

      // Set error for chapter
      runInAction(() => {
        rootStore.chapterStore.errors.set(testPath, errorMessage);
      });

      expect(rootStore.chapterStore.getChapterError(testPath)).toBe(
        errorMessage,
      );

      // Clear error
      rootStore.chapterStore.clearChapter(testPath);
      expect(rootStore.chapterStore.getChapterError(testPath)).toBeNull();
    });

    it("should reset all stores properly", () => {
      // Add data to all stores
      runInAction(() => {
        rootStore.epubStore.chapters = [{ path: "test.xhtml" }] as XMLFile[];
        rootStore.epubStore.currentChapterIndex = 1;
        rootStore.epubStore.metadata = { title: "Test Book" };

        rootStore.chapterStore.markdownResults.set("test", {
          markdown: "test",
          reactTree: null,
        });
        rootStore.chapterStore.errors.set("test", "error");

        rootStore.resourceStore.images.set("test", "data");
        rootStore.resourceStore.footnotes.set("test", "footnote");
      });

      // Verify data exists
      expect(rootStore.epubStore.chapters.length).toBeGreaterThan(0);
      expect(rootStore.chapterStore.cachedChapterCount).toBeGreaterThan(0);
      expect(rootStore.resourceStore.images.size).toBeGreaterThan(0);

      // Reset all stores
      rootStore.reset();

      // Verify all data is cleared
      expect(rootStore.epubStore.epub).toBeNull();
      expect(rootStore.epubStore.chapters).toHaveLength(0);
      expect(rootStore.epubStore.currentChapterIndex).toBe(0);
      expect(rootStore.epubStore.metadata).toEqual({});
      expect(rootStore.chapterStore.cachedChapterCount).toBe(0);
      expect(rootStore.chapterStore.errors.size).toBe(0);
      expect(rootStore.resourceStore.images.size).toBe(0);
      expect(rootStore.resourceStore.footnotes.size).toBe(0);
    });
  });

  describe("Store interaction", () => {
    it("should properly clear resources for a specific chapter", () => {
      const chapter1Path = "chapter1.xhtml";
      const chapter2Path = "chapter2.xhtml";

      runInAction(() => {
        // Add resources for multiple chapters
        rootStore.resourceStore.images.set(`${chapter1Path}:img1.jpg`, "data1");
        rootStore.resourceStore.images.set(`${chapter1Path}:img2.jpg`, "data2");
        rootStore.resourceStore.images.set(`${chapter2Path}:img3.jpg`, "data3");

        rootStore.resourceStore.footnotes.set(`${chapter1Path}:#fn1`, "fn1");
        rootStore.resourceStore.footnotes.set(`${chapter2Path}:#fn2`, "fn2");
      });

      // Verify all resources exist
      expect(rootStore.resourceStore.images.size).toBe(3);
      expect(rootStore.resourceStore.footnotes.size).toBe(2);

      // Clear resources for chapter1 only
      rootStore.resourceStore.clearImagesForChapter(chapter1Path);
      rootStore.resourceStore.clearFootnotesForChapter(chapter1Path);

      // Verify only chapter1 resources were cleared
      expect(rootStore.resourceStore.images.size).toBe(1);
      expect(rootStore.resourceStore.footnotes.size).toBe(1);
      expect(
        rootStore.resourceStore.images.has(`${chapter2Path}:img3.jpg`),
      ).toBe(true);
      expect(
        rootStore.resourceStore.footnotes.has(`${chapter2Path}:#fn2`),
      ).toBe(true);
    });

    it("should coordinate between stores when loading epub", () => {
      const mockEpub = {
        getMetadata: () => ({ title: "Test Book", author: "Test Author" }),
      } as EPub;

      runInAction(() => {
        rootStore.epubStore.epub = mockEpub;
        rootStore.epubStore.metadata = mockEpub.getMetadata();
        rootStore.chapterStore.setConverter(mockEpub);
      });

      expect(rootStore.epubStore.metadata.title).toBe("Test Book");
      expect(rootStore.chapterStore.converter).toBeTruthy();
    });
  });
});
