import { basename, dirname, join, resolve } from "node:path";
import JSZip from "jszip";
import { parseXml } from "./xmlParser";

// Data resolver abstract class and implementations
abstract class DataResolver {
  constructor(public readonly base: string = "") {}

  abstract read(href: string): Promise<string | undefined>;
  abstract readRaw(href: string): Promise<Uint8Array | undefined>;

  // Can be implemented in base class since it just creates new instance
  rebase(base: string): DataResolver {
    return this.createInstance(base);
  }

  async readXMLFile(href: string): Promise<XMLFile | undefined> {
    return XMLFile.load(href, this);
  }

  abstract createInstance(base: string): DataResolver;
}

class ZipDataResolver extends DataResolver {
  constructor(
    private readonly zip: JSZip,
    base = "",
  ) {
    super(base);
  }

  async read(href: string): Promise<string | undefined> {
    const fullPath = this.base ? join(this.base, href) : href;
    const file = this.zip.file(fullPath);
    if (!file) return undefined;
    return await file.async("string");
  }

  async readRaw(href: string): Promise<Uint8Array | undefined> {
    const fullPath = this.base ? join(this.base, href) : href;
    const file = this.zip.file(fullPath);
    if (!file) return undefined;
    return await file.async("uint8array");
  }

  createInstance(base: string): DataResolver {
    return new ZipDataResolver(this.zip, base);
  }
}

class FileDataResolver extends DataResolver {
  constructor(base = "") {
    super(base);
  }

  async read(href: string): Promise<string | undefined> {
    try {
      const fs = await import("node:fs/promises");
      const fullPath = resolve(this.base, href);
      return await fs.readFile(fullPath, "utf-8");
    } catch (error) {
      return undefined;
    }
  }

  async readRaw(href: string): Promise<Uint8Array | undefined> {
    const fs = await import("node:fs/promises");
    const fullPath = resolve(this.base, href);
    const data = await fs.readFile(fullPath);
    return data;
  }

  createInstance(base: string): DataResolver {
    return new FileDataResolver(base);
  }
}

export class XMLFile extends DataResolver {
  constructor(
    public readonly base: string,
    public readonly name: string,
    public readonly content: string,
    public readonly dom: XMLDocument,
    public readonly resolver: DataResolver,
  ) {
    super(base);
  }

  get path() {
    return join(this.base, this.name);
  }

  static async load(
    href: string,
    resolver: DataResolver,
  ): Promise<XMLFile | undefined> {
    const content = await resolver.read(href);
    if (!content) {
      return undefined;
    }

    const dom = parseXml(content) as XMLDocument;
    const newBase = join(resolver.base, dirname(href));
    const name = basename(href);

    return new XMLFile(newBase, name, content, dom, resolver.rebase(newBase));
  }

  async readRaw(href: string): Promise<Uint8Array | undefined> {
    return this.resolver.readRaw(href);
  }

  async read(href: string): Promise<string | undefined> {
    return this.resolver.read(href);
  }

  createInstance(base: string): DataResolver {
    // throw new Error("Not implemented");
    return this.resolver.createInstance(base);
  }

  querySelector(selector: string): Element | null {
    return this.dom.querySelector(selector);
  }

  querySelectorAll(selector: string): NodeListOf<Element> {
    return this.dom.querySelectorAll(selector);
  }
}

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

  static async fromDirectory(directoryPath: string): Promise<EPub> {
    const resolver = new FileDataResolver(directoryPath);
    return await EPub.init(resolver);
  }

  getMetadata(): EPubMetadata {
    const metadata = this.opf.querySelector("metadata");
    if (!metadata) return {};

    const result: EPubMetadata = {};

    // Title
    const title = metadata.querySelector("title");
    if (title) result.title = title.textContent?.trim();

    // Creator/Author
    const creator = metadata.querySelector("creator");
    if (creator) result.author = creator.textContent?.trim();

    // Language
    const language = metadata.querySelector("language");
    if (language) result.language = language.textContent?.trim();

    // Identifier
    const identifier = metadata.querySelector("identifier");
    if (identifier) result.identifier = identifier.textContent?.trim();

    // Description
    const description = metadata.querySelector("description");
    if (description) result.description = description.textContent?.trim();

    // Publisher
    const publisher = metadata.querySelector("publisher");
    if (publisher) result.publisher = publisher.textContent?.trim();

    // Date
    const date = metadata.querySelector("date");
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
}
