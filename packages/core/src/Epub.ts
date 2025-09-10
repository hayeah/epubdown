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
  private _manifestByPath?: Map<string, ManifestItem>;

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
      "/META-INF/container.xml",
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

    const opfRel = rootfile.getAttribute("full-path");
    if (!opfRel) {
      throw new Error("Invalid EPUB: OPF path not found");
    }
    const opfAbs = normalizePath("/", opfRel);

    const opfMediaType = rootfile.getAttribute("media-type") || "xml";
    const opf = await resolver.readDOMFile(opfAbs, opfMediaType);
    if (!opf) {
      throw new Error(`OPF file not found: ${opfAbs}`);
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

  /**
   * Get manifest items indexed by absolute path (memoized)
   */
  manifestByPath(): Map<string, ManifestItem> {
    if (!this._manifestByPath) {
      const items = this.manifest();
      this._manifestByPath = new Map(items.map((m) => [m.path, m]));
    }
    return this._manifestByPath;
  }

  /**
   * Read a DOMFile from the EPUB, automatically resolving media type from manifest
   * @param absPath Absolute path from EPUB root
   * @param explicitMediaType Optional explicit media type, overrides manifest
   */
  async readDOMFile(
    absPath: string,
    explicitMediaType?: string,
  ): Promise<DOMFile | undefined> {
    if (!absPath.startsWith("/")) {
      throw new Error(`absolute path required, got: ${absPath}`);
    }

    // Try to get media type from manifest if not explicitly provided
    let mediaType = explicitMediaType;
    if (!mediaType) {
      const item = this.manifestByPath().get(absPath);
      mediaType = item?.mediaType;
    }

    return this.resolver.readDOMFile(absPath, mediaType);
  }

  async getChapter(absRef: string): Promise<DOMFile | undefined> {
    if (!absRef.startsWith("/")) {
      throw new Error(`absolute chapter path required, got: ${absRef}`);
    }
    return this.readDOMFile(absRef);
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
      const chapter = await this.getChapter(spineItem.manifestItem.path);
      if (!chapter) continue;
      yield chapter;
    }
  }

  /**
   * Convert a chapter to markdown with proper anchor ID preservation
   * @param ref The absolute path to load the chapter
   * @returns Promise<string> The markdown content
   */
  async chapterMarkdown(ref: string): Promise<string> {
    // Ensure ref is absolute
    const absRef = ref.startsWith("/")
      ? ref
      : normalizePath(this.opf.base, ref);

    // Get the chapter DOMFile
    const chapter = await this.getChapter(absRef);
    if (!chapter) {
      throw new Error(`Chapter not found: ${ref}`);
    }

    // Create converter with preserveIDs and basePath for link normalization
    const converter = ContentToMarkdown.create({
      preserveIDs: true,
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
