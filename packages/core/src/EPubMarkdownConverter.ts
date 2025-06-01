import type { EPub, XMLFile } from "./Epub";
import { MarkdownConverter, type MarkdownResult } from "./MarkdownConverter";

export class EPubMarkdownConverter {
  private markdownConverter: MarkdownConverter;

  constructor(private epub: EPub) {
    this.markdownConverter = new MarkdownConverter();
  }

  /**
   * Convert a chapter to markdown with proper anchor ID preservation
   * @param chapterOrHref Either an XMLFile chapter or the href string to load it
   * @returns Promise<string> The markdown content
   */
  async getChapterMD(chapterOrHref: XMLFile | string): Promise<string> {
    const result = await this.getChapterMarkdown(chapterOrHref);
    return result.content;
  }

  /**
   * Convert a chapter to markdown with proper anchor ID preservation
   * @param chapterOrHref Either an XMLFile chapter or the href string to load it
   * @returns Promise<MarkdownResult> The full markdown conversion result including title, images, footnotes
   */
  async getChapterMarkdown(
    chapterOrHref: XMLFile | string,
  ): Promise<MarkdownResult> {
    // Get the chapter XMLFile
    let chapter: XMLFile;
    if (typeof chapterOrHref === "string") {
      const loaded = await this.epub.getChapter(chapterOrHref);
      if (!loaded) {
        throw new Error(`Chapter not found: ${chapterOrHref}`);
      }
      chapter = loaded;
    } else {
      chapter = chapterOrHref;
    }

    // Get TOC anchor links (memoized)
    const tocLinks = await this.epub.tocAnchorLinks();

    // Get the keepIds for this chapter
    const chapterPath = chapter.path;
    const keepIds = tocLinks.get(chapterPath) || new Set<string>();

    // Convert to markdown with keepIds
    return await this.markdownConverter.convertXMLFile(chapter, { keepIds });
  }

  /**
   * Convert HTML content to markdown
   * @param htmlContent The HTML content to convert
   * @param xmlFile The XMLFile context for resolving references
   * @returns Promise<string> The markdown content
   */
  async convertHtmlToMarkdown(
    htmlContent: string,
    xmlFile: XMLFile,
  ): Promise<string> {
    // Get TOC anchor links (memoized)
    const tocLinks = await this.epub.tocAnchorLinks();

    // Get the keepIds for this chapter
    const chapterPath = xmlFile.path;
    const keepIds = tocLinks.get(chapterPath) || new Set<string>();

    // Convert to markdown with keepIds
    const result = await this.markdownConverter.convertXMLFile(xmlFile, {
      keepIds,
    });
    return result.content;
  }
}
