import { ContentToMarkdown } from "./ContentToMarkdown";
import type { EPub } from "./Epub";
import type { XMLFile } from "./XMLFile";

export class EPubMarkdownConverter {
  constructor(private epub: EPub) {}

  /**
   * Convert a chapter to markdown with proper anchor ID preservation
   * @param chapterOrHref Either an XMLFile chapter or the href string to load it
   * @returns Promise<string> The markdown content
   */
  async getChapterMD(chapterOrHref: XMLFile | string): Promise<string> {
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
    const tocLinks = await this.epub.toc.anchorLinks();

    // Get the keepIds for this chapter
    const chapterPath = chapter.path;
    const keepIds = tocLinks.get(chapterPath) || new Set<string>();

    // Create converter with keepIds
    const converter = ContentToMarkdown.create({ keepIds });

    // Convert to markdown
    return await converter.convertXMLFile(chapter);
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
    const tocLinks = await this.epub.toc.anchorLinks();

    // Get the keepIds for this chapter
    const chapterPath = xmlFile.path;
    const keepIds = tocLinks.get(chapterPath) || new Set<string>();

    // Create converter with keepIds
    const converter = ContentToMarkdown.create({ keepIds });

    // Convert to markdown
    return await converter.convertXMLFile(xmlFile);
  }
}
