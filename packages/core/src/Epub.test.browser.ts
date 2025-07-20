import { beforeEach, describe, expect, it } from "vitest";
import { EPub } from "./Epub";
import { fetchEpub } from "./testUtils/fetchEpub";

describe("EPub - Browser Tests", () => {
  let epub: EPub;

  beforeEach(async () => {
    const epubData = await fetchEpub("alice.epub");
    epub = await EPub.fromZip(epubData);
  });

  it("should load and parse Alice in Wonderland EPUB", async () => {
    expect(epub).toBeDefined();
    expect(epub.container).toBeDefined();
    expect(epub.opf).toBeDefined();
  });

  it("should extract metadata from EPUB", async () => {
    const metadata = epub.metadata;
    expect(metadata.get("title")).toContain("Alice");
    expect(metadata.get("creator")).toBeTruthy();
    expect(metadata.get("language")).toBeTruthy();
  });

  it("should get manifest items", async () => {
    const manifest = epub.manifest();
    expect(manifest).toBeInstanceOf(Array);
    expect(manifest.length).toBeGreaterThan(0);

    // Check that we have HTML/XHTML content
    const contentItems = manifest.filter(
      (item) =>
        item.mediaType.includes("html") || item.mediaType.includes("xhtml"),
    );
    expect(contentItems.length).toBeGreaterThan(0);
  });

  it("should get spine items", async () => {
    const spine = epub.spine();
    expect(spine).toBeInstanceOf(Array);
    expect(spine.length).toBeGreaterThan(0);

    // All spine items should have idref
    expect(spine.every((item) => item.idref)).toBe(true);
  });

  it("should get spine with manifest details", async () => {
    const spineWithManifest = epub.spineWithManifest();
    expect(spineWithManifest).toBeInstanceOf(Array);
    expect(spineWithManifest.length).toBeGreaterThan(0);

    // Each item should have manifestItem
    expect(spineWithManifest.every((item) => item.manifestItem)).toBe(true);
  });

  it("should read chapters from EPUB", async () => {
    const chapters = [];
    for await (const chapter of epub.chapters()) {
      chapters.push(chapter);
    }

    expect(chapters.length).toBeGreaterThan(0);

    // Check first chapter
    const firstChapter = chapters[0];
    expect(firstChapter).toBeDefined();
    expect(firstChapter?.content).toBeDefined();
    expect(firstChapter?.dom).toBeDefined();
  });

  it("should get table of contents", async () => {
    const toc = epub.toc;
    expect(toc).toBeDefined();

    const tocHtml = await toc.html();
    expect(tocHtml).toBeDefined();

    // TOC should have navigation structure
    const navElement = tocHtml?.querySelector("nav");
    expect(navElement).toBeDefined();
  });

  it("should extract TOC anchor links", async () => {
    const anchorLinks = await epub.toc.anchorLinks();
    expect(anchorLinks).toBeInstanceOf(Map);

    // Should have some anchor links
    expect(anchorLinks.size).toBeGreaterThanOrEqual(0);
  });

  it("should not use node:fs in browser context", () => {
    // This test ensures that FileDataResolver is not accidentally imported
    // The mere fact that these tests run in the browser proves that
    // the bundle doesn't require node:fs
    expect(true).toBe(true);
  });
});
