import JSZip from "jszip";
import { ContentToMarkdown } from "./ContentToMarkdown";
import { Metadata } from "./Metadata";
import { TableOfContents } from "./TableOfContents";
import type { XMLFile } from "./XMLFile";
import { type DataResolver, ZipDataResolver } from "./resolvers";

/*
 * EPUB 3.3 Required Metadata:
 * According to the EPUB specification, only these metadata elements are required:
 * - dc:identifier - Unique identifier for the publication
 * - dc:title - Title of the publication
 * - dc:language - Language of the publication
 */

interface ManifestItem {
  id: string;
  href: string;
  mediaType: string;
  properties?: string;
}

interface SpineItem {
  idref: string;
  linear: boolean;
}

export class EPub {
  private _toc?: TableOfContents;
  private _metadata?: Metadata;

  constructor(
    public readonly container: XMLFile,
    public readonly opf: XMLFile,
  ) {}

  /**
   * Get the table of contents handler
   */
  get toc(): TableOfContents {
    if (!this._toc) {
      this._toc = new TableOfContents(this);
    }
    return this._toc;
  }

  static async init(resolver: DataResolver): Promise<EPub> {
    // Parse container.xml
    const container = await resolver.readXMLFile("META-INF/container.xml");
    if (!container) {
      throw new Error("Invalid EPUB: META-INF/container.xml not found");
    }

    // Find OPF file
    const rootfile = container.querySelector(
      'rootfile[media-type="application/oebps-package+xml"]',
    );
    if (!rootfile) {
      throw new Error("Invalid EPUB: OPF file not found in container");
    }

    const opfPath = rootfile.getAttribute("full-path");
    if (!opfPath) {
      throw new Error("Invalid EPUB: OPF path not found");
    }

    const opf = await resolver.readXMLFile(opfPath);
    if (!opf) {
      throw new Error(`OPF file not found: ${opfPath}`);
    }

    return new EPub(container, opf);
  }

  static async fromZip(
    zipData: ArrayBuffer | Uint8Array | Buffer,
  ): Promise<EPub> {
    const zip = await JSZip.loadAsync(zipData);
    const resolver = new ZipDataResolver(zip);
    return await EPub.init(resolver);
  }

  // static async fromDirectory(directoryPath: string): Promise<EPub> {
  //   const resolver = new FileDataResolver(directoryPath);
  //   return await EPub.init(resolver);
  // }

  /**
   * Get the metadata handler
   */
  get metadata(): Metadata {
    if (!this._metadata) {
      const metadataElement = this.opf.querySelector("metadata");
      if (!metadataElement) {
        throw new Error("EPUB metadata element not found");
      }
      this._metadata = Metadata.fromDom(metadataElement);
    }
    return this._metadata;
  }

  getManifest(): ManifestItem[] {
    const manifest = this.opf.querySelector("manifest");
    if (!manifest) return [];

    const items = manifest.querySelectorAll("item");
    return Array.from(items).map((item) => ({
      id: item.getAttribute("id") || "",
      href: item.getAttribute("href") || "",
      mediaType: item.getAttribute("media-type") || "",
      properties: item.getAttribute("properties") || undefined,
    }));
  }

  getSpine(linearOnly = true): SpineItem[] {
    const spine = this.opf.querySelector("spine");
    if (!spine) return [];

    const itemrefs = spine.querySelectorAll("itemref");
    return Array.from(itemrefs)
      .map((itemref) => ({
        idref: itemref.getAttribute("idref") || "",
        linear: itemref.getAttribute("linear") !== "no",
      }))
      .filter((item) => (linearOnly ? item.linear : true));
  }

  // Helper to get spine items with their manifest details
  getSpineWithManifest(
    linearOnly = true,
  ): (SpineItem & { manifestItem: ManifestItem })[] {
    const spine = this.getSpine(linearOnly);
    const manifest = this.getManifest();
    const manifestMap = new Map(manifest.map((item) => [item.id, item]));

    const result: (SpineItem & { manifestItem: ManifestItem })[] = [];

    for (const spineItem of spine) {
      const manifestItem = manifestMap.get(spineItem.idref);
      if (!manifestItem) {
        continue;
      }
      result.push({
        ...spineItem,
        manifestItem,
      });
    }

    return result;
  }

  async getChapter(href: string): Promise<XMLFile | undefined> {
    return this.opf.readXMLFile(href);
  }

  /**
   * Async generator to iterate through spine chapters
   * @param linearOnly If true, skip non-linear spine items
   * @returns Generator yielding XMLFile objects with href and title properties
   */
  async *getChapters(linearOnly = true): AsyncGenerator<XMLFile> {
    const spineItems = this.getSpineWithManifest(linearOnly).filter(
      (item) =>
        item.manifestItem.mediaType.includes("xhtml") ||
        item.manifestItem.mediaType.includes("html"),
    );

    for (const spineItem of spineItems) {
      const href = spineItem.manifestItem.href;
      const chapter = await this.getChapter(href);
      if (!chapter) continue;
      yield chapter;
    }
  }

  /**
   * Convert a chapter to markdown with proper anchor ID preservation
   * @param href The href string to load the chapter
   * @returns Promise<string> The markdown content
   */
  async getChapterMD(href: string): Promise<string> {
    // Get the chapter XMLFile
    const chapter = await this.getChapter(href);
    if (!chapter) {
      throw new Error(`Chapter not found: ${href}`);
    }

    // Get TOC anchor links (memoized)
    const tocLinks = await this.toc.anchorLinks();

    // Get the keepIds for this chapter
    const chapterPath = chapter.path;
    const keepIds = tocLinks.get(chapterPath) || new Set<string>();

    // Create converter with keepIds
    const converter = ContentToMarkdown.create({ keepIds });

    // Convert to markdown
    return await converter.convertXMLFile(chapter);
  }
}
