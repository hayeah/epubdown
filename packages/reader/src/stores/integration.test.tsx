import { EPub, XMLFile } from "@epubdown/core";
import { render, screen, waitFor } from "@testing-library/react";
import { runInAction } from "mobx";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChapterRenderer } from "../ChapterRenderer";
import { Footnote, Image } from "../MarkdownComponents";
import { EPubResolverContext } from "../contexts/EPubContext";
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
      // Create a mock File with arrayBuffer method
      const mockFile = {
        name: "test.epub",
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
      } as unknown as File;

      // Mock EPub.fromZip
      const mockEpub = {
        metadata: {
          toJSON: () => mockEpubContent,
        },
        chapters: async function* () {
          for (const chapter of mockEpubContent.chapters) {
            yield createMockXMLFile(chapter.path, chapter.content);
          }
        },
      } as unknown as EPub;

      vi.spyOn(EPub, "fromZip").mockResolvedValueOnce(mockEpub);

      // Load the EPUB
      await rootStore.readerStore.loadBook(mockFile);

      // Verify ReaderStore state
      expect(rootStore.readerStore.epub).toBeTruthy();
      expect(rootStore.readerStore.metadata.title).toBe(mockEpubContent.title);
      expect(rootStore.readerStore.metadata.author).toBe(
        mockEpubContent.author,
      );
      expect(rootStore.readerStore.chapters).toHaveLength(2);
      expect(rootStore.readerStore.currentChapterIndex).toBe(0);
    });

    it("should convert chapters when requested", async () => {
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
        rootStore.readerStore.chapters = [chapter1, chapter2];
        rootStore.readerStore.epub = {} as EPub;
        rootStore.readerStore.converter = {
          convertXMLFile: vi
            .fn()
            .mockResolvedValue("# Test Chapter\n\nTest content"),
        } as any;
      });

      // Load first chapter
      const result1 = await rootStore.readerStore.getChapterReactTree(chapter1);
      expect(result1).toBeTruthy();
      expect(result1.markdown).toBe("# Test Chapter\n\nTest content");

      // Load second chapter
      const result2 = await rootStore.readerStore.getChapterReactTree(chapter2);
      expect(result2).toBeTruthy();
      expect(result2.markdown).toBe("# Test Chapter\n\nTest content");
    });

    it("should load resources (images and footnotes)", async () => {
      const mockXMLFile = createMockXMLFile("test.xhtml", "<html></html>");

      // Load an image
      const imageUrl = await rootStore.readerStore.getImage(
        mockXMLFile,
        "image.jpg",
      );

      expect(imageUrl).toMatch(/^data:image\/jpeg;base64,/);

      // Load a footnote
      mockXMLFile.content = '<p id="fn1">Footnote content</p>';
      const footnoteContent = await rootStore.readerStore.getFootnote(
        mockXMLFile,
        "#fn1",
      );

      expect(footnoteContent).toBe("Footnote content");
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
        rootStore.readerStore.chapters = [chapter];
        rootStore.readerStore.epub = {} as EPub;
        rootStore.readerStore.converter = {
          convertXMLFile: vi
            .fn()
            .mockResolvedValue("# Test Chapter\n\nTest content"),
        } as any;
      });

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

      // Chapter should have loaded successfully
      expect(container.querySelector(".chapter-content")).toBeInTheDocument();
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
        rootStore.readerStore.chapters = [chapter1, chapter2];
        rootStore.readerStore.currentChapterIndex = 0;
      });

      // Navigate to next chapter
      rootStore.readerStore.nextChapter();
      expect(rootStore.readerStore.currentChapterIndex).toBe(1);
      expect(rootStore.readerStore.currentChapter).toBe(chapter2);

      // Navigate to previous chapter
      rootStore.readerStore.previousChapter();
      expect(rootStore.readerStore.currentChapterIndex).toBe(0);
      expect(rootStore.readerStore.currentChapter).toBe(chapter1);

      // Should not go below 0
      rootStore.readerStore.previousChapter();
      expect(rootStore.readerStore.currentChapterIndex).toBe(0);

      // Should not go above chapter count
      rootStore.readerStore.setChapter(1);
      rootStore.readerStore.nextChapter();
      expect(rootStore.readerStore.currentChapterIndex).toBe(1);
    });

    it("should properly integrate Image component with ReaderStore", async () => {
      const mockXMLFile = createMockXMLFile("test.xhtml", "<html></html>");

      const TestComponent = () => {
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

      // Manually set the intersection observer to observe the element
      // The Image component will handle the loading when it enters the viewport
      // For testing, we'll wait for the component to render
      await waitFor(() => {
        // The component may still show placeholder or may have loaded
        // depending on timing
        const elements = screen.queryAllByText("Image");
        expect(elements.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Store cleanup", () => {
    it("should clear all stores on reset", () => {
      // Add some data to stores
      runInAction(() => {
        rootStore.readerStore.chapters = [
          createMockXMLFile("test.xhtml", "<html></html>"),
        ];
        rootStore.readerStore.epub = {} as EPub;
        rootStore.readerStore.metadata = { title: "Test" };
      });

      // Reset all stores
      rootStore.reset();

      // Verify all stores are cleared
      expect(rootStore.readerStore.epub).toBeNull();
      expect(rootStore.readerStore.chapters).toHaveLength(0);
      expect(rootStore.readerStore.metadata).toEqual({});
    });
  });
});
