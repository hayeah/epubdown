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
      expect(rootStore.readerStore.epub).toBeNull();
      expect(rootStore.readerStore.chapters).toHaveLength(0);
      expect(rootStore.readerStore.currentChapterIndex).toBe(0);
      expect(rootStore.readerStore.metadata).toEqual({});
    });

    it("should handle chapter navigation", () => {
      // Create mock chapters
      const mockChapters = [
        { path: "ch1.xhtml" },
        { path: "ch2.xhtml" },
        { path: "ch3.xhtml" },
      ] as XMLFile[];

      runInAction(() => {
        rootStore.readerStore.chapters = mockChapters;
      });

      // Test navigation
      expect(rootStore.readerStore.currentChapterIndex).toBe(0);
      expect(rootStore.readerStore.currentChapter).toStrictEqual(
        mockChapters[0],
      );

      // Next chapter
      rootStore.readerStore.nextChapter();
      expect(rootStore.readerStore.currentChapterIndex).toBe(1);
      expect(rootStore.readerStore.currentChapter).toStrictEqual(
        mockChapters[1],
      );

      // Previous chapter
      rootStore.readerStore.previousChapter();
      expect(rootStore.readerStore.currentChapterIndex).toBe(0);

      // Set specific chapter
      rootStore.readerStore.setChapter(2);
      expect(rootStore.readerStore.currentChapterIndex).toBe(2);
      expect(rootStore.readerStore.currentChapter).toStrictEqual(
        mockChapters[2],
      );

      // Should not go beyond bounds
      rootStore.readerStore.nextChapter();
      expect(rootStore.readerStore.currentChapterIndex).toBe(2);

      rootStore.readerStore.setChapter(0);
      rootStore.readerStore.previousChapter();
      expect(rootStore.readerStore.currentChapterIndex).toBe(0);
    });

    it("should reset all stores properly", () => {
      // Add data to all stores
      runInAction(() => {
        rootStore.readerStore.chapters = [{ path: "test.xhtml" }] as XMLFile[];
        rootStore.readerStore.currentChapterIndex = 1;
        rootStore.readerStore.metadata = { title: "Test Book" };
        rootStore.readerStore.epub = {} as EPub;
      });

      // Verify data exists
      expect(rootStore.readerStore.chapters.length).toBeGreaterThan(0);
      expect(rootStore.readerStore.epub).not.toBeNull();

      // Reset all stores
      rootStore.reset();

      // Verify all data is cleared
      expect(rootStore.readerStore.epub).toBeNull();
      expect(rootStore.readerStore.chapters).toHaveLength(0);
      expect(rootStore.readerStore.currentChapterIndex).toBe(0);
      expect(rootStore.readerStore.metadata).toEqual({});
    });
  });

  describe("Store interaction", () => {
    it("should coordinate between stores when loading epub", () => {
      const mockEpub = {
        metadata: {
          toJSON: () => ({ title: "Test Book", author: "Test Author" }),
        },
      } as EPub;

      runInAction(() => {
        rootStore.readerStore.epub = mockEpub;
        rootStore.readerStore.metadata = mockEpub.metadata.toJSON();
      });

      expect(rootStore.readerStore.metadata.title).toBe("Test Book");
      expect(rootStore.readerStore.metadata.author).toBe("Test Author");
    });
  });
});
