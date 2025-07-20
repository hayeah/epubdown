import { join } from "node:path";
import JSZip from "jszip";
import { XMLFile } from "./XMLFile";
import { type DataResolver, ZipDataResolver } from "./resolvers";
import { parseXml } from "./xmlParser";

interface EPubMetadata {
  title?: string;
  author?: string;
  language?: string;
  identifier?: string;
  description?: string;
  publisher?: string;
  date?: string;
}

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
  private _tocAnchorLinks?: Map<string, Set<string>>;

  constructor(
    public readonly container: XMLFile,
    public readonly opf: XMLFile,
  ) {}

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

  getMetadata(): EPubMetadata {
    const metadata = this.opf.querySelector("metadata");
    if (!metadata) return {};

    const result: EPubMetadata = {};

    // Title - try both with and without namespace
    const title = metadata.querySelector("dc\\:title, title");
    if (title) result.title = title.textContent?.trim();

    // Creator/Author
    const creator = metadata.querySelector("dc\\:creator, creator");
    if (creator) result.author = creator.textContent?.trim();

    // Language
    const language = metadata.querySelector("dc\\:language, language");
    if (language) result.language = language.textContent?.trim();

    // Identifier
    const identifier = metadata.querySelector("dc\\:identifier, identifier");
    if (identifier) result.identifier = identifier.textContent?.trim();

    // Description
    const description = metadata.querySelector("dc\\:description, description");
    if (description) result.description = description.textContent?.trim();

    // Publisher
    const publisher = metadata.querySelector("dc\\:publisher, publisher");
    if (publisher) result.publisher = publisher.textContent?.trim();

    // Date
    const date = metadata.querySelector("dc\\:date, date");
    if (date) result.date = date.textContent?.trim();

    return result;
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

  async toc(): Promise<XMLFile | undefined> {
    // First check for EPUB3 nav document
    const navFile = await this.nav();
    if (navFile) {
      return navFile;
    }

    // Otherwise try to convert NCX to HTML
    return await this.ncxToHTML();
  }

  async nav(): Promise<XMLFile | undefined> {
    const manifest = this.opf.querySelector("manifest");
    if (!manifest) return undefined;

    const navItem = manifest.querySelector('item[properties~="nav"]');
    if (!navItem) return undefined;

    const href = navItem.getAttribute("href");
    if (!href) return undefined;

    return this.opf.readXMLFile(href);
  }

  async ncx(): Promise<XMLFile | undefined> {
    const manifest = this.opf.querySelector("manifest");
    if (!manifest) return undefined;

    const ncxItem = manifest.querySelector(
      'item[media-type="application/x-dtbncx+xml"]',
    );
    if (!ncxItem) return undefined;

    const href = ncxItem.getAttribute("href");
    if (!href) return undefined;

    return this.opf.readXMLFile(href);
  }

  async ncxToHTML(): Promise<XMLFile | undefined> {
    const ncxFile = await this.ncx();
    if (!ncxFile) return undefined;

    const navMap = ncxFile.querySelector("navMap");
    if (!navMap) {
      return undefined;
    }

    const convertNavPoints = (parent: Element): string => {
      const navPoints = Array.from(
        parent.querySelectorAll(":scope > navPoint"),
      );
      if (navPoints.length === 0) {
        return "";
      }

      const items = navPoints
        .map((navPoint) => {
          const label =
            navPoint.querySelector("text")?.textContent?.trim() || "";
          const href =
            navPoint.querySelector("content")?.getAttribute("src") || "";
          const children = convertNavPoints(navPoint);

          return `<li><a href="${href}">${label}</a>${children}</li>`;
        })
        .join("\n");

      return `<ul>\n${items}\n</ul>`;
    };

    const olMarkup = convertNavPoints(navMap);
    const html = `<nav epub:type="toc">\n${olMarkup}\n</nav>`;

    return new XMLFile(
      ncxFile.base,
      "ncx.xml.html",
      html,
      parseXml(html) as XMLDocument,
      ncxFile.resolver,
    );
  }

  /**
   * Extract all anchor links from the table of contents
   * Returns a Map where keys are resolved file paths and values are Sets of anchor IDs
   * Results are memoized for performance
   */
  async tocAnchorLinks(): Promise<Map<string, Set<string>>> {
    // Return memoized result if available
    if (this._tocAnchorLinks) {
      return this._tocAnchorLinks;
    }

    const tocFile = await this.toc();
    if (!tocFile) {
      this._tocAnchorLinks = new Map();
      return this._tocAnchorLinks;
    }

    const anchorMap = new Map<string, Set<string>>();

    // Find all links in the TOC
    const links = tocFile.querySelectorAll(`nav[epub\\:type="toc"] a[href]`);

    for (const link of Array.from(links)) {
      const href = link.getAttribute("href");
      if (!href) continue;

      // Split href into file path and anchor
      const [filePath, anchor] = href.split("#");
      if (!filePath || !anchor) continue;

      // Resolve the file path relative to the TOC file
      const resolvedPath = join(tocFile.base, filePath);

      // Add anchor to the set for this file
      if (!anchorMap.has(resolvedPath)) {
        anchorMap.set(resolvedPath, new Set());
      }
      anchorMap.get(resolvedPath)?.add(anchor);
    }

    // Memoize the result
    this._tocAnchorLinks = anchorMap;
    return anchorMap;
  }
}
