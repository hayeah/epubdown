import { render, screen, waitFor } from "@testing-library/react";
import { runInAction } from "mobx";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChapterRenderer } from "../ChapterRenderer";
import { EPub, XMLFile } from "../Epub";
import { Footnote, Image } from "../MarkdownComponents";
import { EPubResolverContext } from "../MarkdownConverter";
import { StoreProvider } from "./RootStore";
import { RootStore } from "./RootStore";

// Mock data
const mockEpubContent = {
  title: "Test Book",
  author: "Test Author",
  chapters: [
    {
      path: "chapter1.xhtml",
      content: `
				<html>
					<body>
						<h1>Chapter 1</h1>
						<p>This is the first chapter with an <img src="image.jpg" alt="test image" />.</p>
						<p>And a footnote<a href="#fn1" epub:type="noteref">1</a>.</p>
						<aside id="fn1" epub:type="footnote">
							<p>This is footnote content.</p>
						</aside>
					</body>
				</html>
			`,
    },
    {
      path: "chapter2.xhtml",
      content: `
				<html>
					<body>
						<h1>Chapter 2</h1>
						<p>This is the second chapter.</p>
					</body>
				</html>
			`,
    },
  ],
};

// Create mock XMLFile
function createMockXMLFile(path: string, content: string): XMLFile {
  const parser = new DOMParser();
  const dom = parser.parseFromString(content, "text/html") as any;

  const mockResolver = {
    base: "",
    read: vi.fn().mockResolvedValue(content),
    readRaw: vi.fn().mockResolvedValue(new Uint8Array([137, 80, 78, 71])), // PNG header
    rebase: vi.fn().mockReturnThis(),
    readXMLFile: vi.fn(),
    createInstance: vi.fn().mockReturnThis(),
  };

  return new XMLFile("", path, content, dom, mockResolver);
}

describe("MobX Store Integration", () => {
  let rootStore: RootStore;

  beforeEach(() => {
    rootStore = new RootStore();
  });

  describe("Store interactions", () => {
    it("should load an EPUB and update all stores", async () => {
      // Create a mock File
      const mockFile = new File(["mock epub content"], "test.epub", {
        type: "application/epub+zip",
      });

      // Mock EPub.fromZip
      const mockEpub = {
        getMetadata: () => mockEpubContent,
        getChapters: async function* () {
          for (const chapter of mockEpubContent.chapters) {
            yield createMockXMLFile(chapter.path, chapter.content);
          }
        },
      } as unknown as EPub;

      vi.spyOn(EPub, "fromZip").mockResolvedValueOnce(mockEpub);

      // Load the EPUB
      await rootStore.epubStore.loadEpub(mockFile);

      // Verify EPubStore state
      expect(rootStore.epubStore.epub).toBeTruthy();
      expect(rootStore.epubStore.metadata.title).toBe(mockEpubContent.title);
      expect(rootStore.epubStore.metadata.author).toBe(mockEpubContent.author);
      expect(rootStore.epubStore.chapters).toHaveLength(2);
      expect(rootStore.epubStore.currentChapterIndex).toBe(0);
      expect(rootStore.epubStore.isLoading).toBe(false);
      expect(rootStore.epubStore.error).toBeNull();
    });

    it("should lazily convert chapters only when requested", async () => {
      // Setup mock EPUB in store
      const chapter1 = createMockXMLFile(
        mockEpubContent.chapters[0].path,
        mockEpubContent.chapters[0].content,
      );
      const chapter2 = createMockXMLFile(
        mockEpubContent.chapters[1].path,
        mockEpubContent.chapters[1].content,
      );

      runInAction(() => {
        rootStore.epubStore.chapters = [chapter1, chapter2];
        rootStore.epubStore.epub = {} as EPub;
        rootStore.chapterStore.setConverter({} as EPub);
      });

      // Initially, no chapters should be converted
      expect(rootStore.chapterStore.cachedChapterCount).toBe(0);

      // Load first chapter
      await rootStore.chapterStore.loadChapter(chapter1);

      // Only first chapter should be converted
      expect(rootStore.chapterStore.cachedChapterCount).toBe(1);
      expect(
        rootStore.chapterStore.getChapterResult(chapter1.path),
      ).toBeTruthy();
      expect(rootStore.chapterStore.getChapterResult(chapter2.path)).toBeNull();

      // Load second chapter
      await rootStore.chapterStore.loadChapter(chapter2);

      // Both chapters should now be converted
      expect(rootStore.chapterStore.cachedChapterCount).toBe(2);
      expect(
        rootStore.chapterStore.getChapterResult(chapter2.path),
      ).toBeTruthy();
    });

    it("should cache resources (images and footnotes)", async () => {
      const mockXMLFile = createMockXMLFile("test.xhtml", "<html></html>");

      // Load an image
      const imageUrl = await rootStore.resourceStore.loadImage(
        mockXMLFile,
        "image.jpg",
      );

      expect(imageUrl).toMatch(/^data:image\/jpeg;base64,/);
      expect(rootStore.resourceStore.getImage(mockXMLFile, "image.jpg")).toBe(
        imageUrl,
      );

      // Load the same image again - should return cached result
      const cachedImageUrl = await rootStore.resourceStore.loadImage(
        mockXMLFile,
        "image.jpg",
      );
      expect(cachedImageUrl).toBe(imageUrl);

      // Load a footnote
      mockXMLFile.content = '<p id="fn1">Footnote content</p>';
      const footnoteContent = await rootStore.resourceStore.loadFootnote(
        mockXMLFile,
        "#fn1",
      );

      expect(footnoteContent).toBe("Footnote content");
      expect(rootStore.resourceStore.getFootnote(mockXMLFile, "#fn1")).toBe(
        "Footnote content",
      );
    });
  });

  describe("Component integration", () => {
    it("should render ChapterRenderer with MobX stores", async () => {
      const chapter = createMockXMLFile(
        "chapter1.xhtml",
        "<h1>Test Chapter</h1><p>Test content</p>",
      );

      // Setup store state
      runInAction(() => {
        rootStore.epubStore.chapters = [chapter];
        rootStore.epubStore.epub = {} as EPub;
        rootStore.chapterStore.setConverter({} as EPub);
      });

      // Mock the markdown converter
      const mockConverter = {
        convertHtmlToMarkdown: vi
          .fn()
          .mockResolvedValue("# Test Chapter\n\nTest content"),
      };
      rootStore.chapterStore.converter = mockConverter as any;

      const { container } = render(
        <StoreProvider value={rootStore}>
          <ChapterRenderer xmlFile={chapter} />
        </StoreProvider>,
      );

      // Should show loading initially
      expect(screen.getByText("Loading chapter...")).toBeInTheDocument();

      // Wait for chapter to load
      await waitFor(() => {
        expect(container.querySelector(".chapter-content")).toBeInTheDocument();
      });

      // Verify chapter was converted and cached
      expect(rootStore.chapterStore.cachedChapterCount).toBe(1);
    });

    it("should handle navigation between chapters", async () => {
      const chapter1 = createMockXMLFile(
        "chapter1.xhtml",
        "<h1>Chapter 1</h1>",
      );
      const chapter2 = createMockXMLFile(
        "chapter2.xhtml",
        "<h1>Chapter 2</h1>",
      );

      runInAction(() => {
        rootStore.epubStore.chapters = [chapter1, chapter2];
        rootStore.epubStore.currentChapterIndex = 0;
      });

      // Navigate to next chapter
      rootStore.epubStore.nextChapter();
      expect(rootStore.epubStore.currentChapterIndex).toBe(1);
      expect(rootStore.epubStore.currentChapter).toBe(chapter2);

      // Navigate to previous chapter
      rootStore.epubStore.previousChapter();
      expect(rootStore.epubStore.currentChapterIndex).toBe(0);
      expect(rootStore.epubStore.currentChapter).toBe(chapter1);

      // Should not go below 0
      rootStore.epubStore.previousChapter();
      expect(rootStore.epubStore.currentChapterIndex).toBe(0);

      // Should not go above chapter count
      rootStore.epubStore.setCurrentChapter(1);
      rootStore.epubStore.nextChapter();
      expect(rootStore.epubStore.currentChapterIndex).toBe(1);
    });

    it("should properly integrate Image component with ResourceStore", async () => {
      const mockXMLFile = createMockXMLFile("test.xhtml", "<html></html>");

      const TestComponent = () => {
        const resourceStore = rootStore.resourceStore;
        // Manually trigger image load for testing
        React.useEffect(() => {
          resourceStore.loadImage(mockXMLFile, "test.jpg");
        }, [resourceStore]);

        return (
          <StoreProvider value={rootStore}>
            <EPubResolverContext.Provider value={{ resolver: mockXMLFile }}>
              <Image href="test.jpg" alt="Test image" />
            </EPubResolverContext.Provider>
          </StoreProvider>
        );
      };

      render(<TestComponent />);

      // Initially should show placeholder
      expect(screen.getByText("Image")).toBeInTheDocument();

      // Wait for image to load
      await waitFor(() => {
        const img = screen.getByAltText("Test image") as HTMLImageElement;
        expect(img).toBeInTheDocument();
        expect(img.src).toMatch(/^data:image\/jpeg;base64,/);
      });

      // Verify image was cached
      expect(
        rootStore.resourceStore.getImage(mockXMLFile, "test.jpg"),
      ).toBeTruthy();
    });
  });

  describe("Store cleanup", () => {
    it("should clear all stores on reset", () => {
      // Add some data to stores
      runInAction(() => {
        rootStore.epubStore.chapters = [
          createMockXMLFile("test.xhtml", "<html></html>"),
        ];
        rootStore.chapterStore.markdownResults.set("test", {
          markdown: "test",
          reactTree: null,
        });
        rootStore.resourceStore.images.set(
          "test",
          "data:image/jpeg;base64,test",
        );
      });

      // Reset all stores
      rootStore.reset();

      // Verify all stores are cleared
      expect(rootStore.epubStore.epub).toBeNull();
      expect(rootStore.epubStore.chapters).toHaveLength(0);
      expect(rootStore.chapterStore.cachedChapterCount).toBe(0);
      expect(rootStore.resourceStore.images.size).toBe(0);
    });
  });
});
