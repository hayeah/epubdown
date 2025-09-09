import JSZip from "jszip";
import { ContentToMarkdown } from "./ContentToMarkdown";
import type { DOMFile } from "./DOMFile";
import { Metadata } from "./Metadata";
import { TableOfContents } from "./TableOfContents";
import { type DataResolver, ZipDataResolver } from "./resolvers";
import { normalizePath } from "./utils/normalizePath";

/*
 * EPUB 3.3 Required Metadata:
 * According to the EPUB specification, only these metadata elements are required:
 * - dc:identifier - Unique identifier for the publication
 * - dc:title - Title of the publication
 * - dc:language - Language of the publication
 */

export interface ManifestItem {
  id: string;
  href: string;
  path: string;
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
    public readonly container: DOMFile,
    public readonly opf: DOMFile,
    public readonly resolver: DataResolver,
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
    const container = await resolver.readDOMFile(
      "META-INF/container.xml",
      "xml",
    );
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

    const opfMediaType = rootfile.getAttribute("media-type");
    const opf = await resolver.readDOMFile(opfPath, opfMediaType);
    if (!opf) {
      throw new Error(`OPF file not found: ${opfPath}`);
    }

    return new EPub(container, opf, resolver);
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

  manifest(): ManifestItem[] {
    const manifest = this.opf.querySelector("manifest");
    if (!manifest) return [];

    const items = manifest.querySelectorAll("item");
    return Array.from(items).map((item) => {
      const href = item.getAttribute("href") || "";
      const decodedHref = decodeURIComponent(href);
      const path = normalizePath(this.opf.base, decodedHref);
      return {
        id: item.getAttribute("id") || "",
        href,
        path,
        mediaType: item.getAttribute("media-type") || "",
        properties: item.getAttribute("properties") || undefined,
      };
    });
  }

  spine(linearOnly = true): SpineItem[] {
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
  spineWithManifest(
    linearOnly = true,
  ): (SpineItem & { manifestItem: ManifestItem })[] {
    const spine = this.spine(linearOnly);
    const manifest = this.manifest();
    const manifestMap = new Map(manifest.map((item) => [item.id, item]));

    const result: (SpineItem & { manifestItem: ManifestItem })[] = [];

    for (const spineItem of spine) {
      const manifestItem = manifestMap.get(spineItem.idref);
      if (!manifestItem) {
        continue;
      }
      result.push({
        ...spineItem,
        manifestItem: {
          ...manifestItem,
          path: manifestItem.path,
        },
      });
    }

    return result;
  }

  async getChapter(ref: string): Promise<DOMFile | undefined> {
    // Determine content type from OPF manifest media-type when possible
    const manifestItems = this.manifest();
    const manifestByPath = new Map(
      manifestItems.map((m) => [m.path, m as ManifestItem]),
    );

    // Normalize the incoming ref to an absolute path for matching
    const absoluteRef = normalizePath(this.opf.base, ref);

    const manifestItem = manifestByPath.get(absoluteRef);
    const contentType = manifestItem ? manifestItem.mediaType : undefined;

    // readDOMFile handles both relative and absolute paths and accepts contentType
    return this.opf.readDOMFile(ref, contentType);
  }

  /**
   * Async generator to iterate through spine chapters
   * @param linearOnly If true, skip non-linear spine items
   * @returns Generator yielding DOMFile objects with href and title properties
   */
  async *chapters(linearOnly = true): AsyncGenerator<DOMFile> {
    const spineItems = this.spineWithManifest(linearOnly).filter(
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
   * @param ref The href/path string to load the chapter
   * @returns Promise<string> The markdown content
   */
  async chapterMarkdown(ref: string): Promise<string> {
    // Get the chapter DOMFile
    const chapter = await this.getChapter(ref);
    if (!chapter) {
      throw new Error(`Chapter not found: ${ref}`);
    }

    // Get TOC anchor links (memoized)
    const tocLinks = await this.toc.anchorLinks();

    // Get the keepIds for this chapter
    const chapterPath = chapter.path;
    const keepIds = tocLinks.get(chapterPath) || new Set<string>();

    // Create converter with keepIds and basePath for link normalization
    const converter = ContentToMarkdown.create({
      keepIds,
      basePath: chapter.base,
    });

    // Convert to markdown
    return await converter.convertXMLFile(chapter);
  }

  /**
   * Calculate the SHA256 hash of the OPF file content
   * @returns Promise<Uint8Array> The SHA256 hash as a Uint8Array
   */
  async opfhash(): Promise<Uint8Array> {
    // Directly encode string to Uint8Array and pass to crypto.subtle.digest
    const encoder = new TextEncoder();
    const opfBytes = encoder.encode(this.opf.content);
    const hashBuffer = await crypto.subtle.digest("SHA-256", opfBytes);
    return new Uint8Array(hashBuffer);
  }
}
