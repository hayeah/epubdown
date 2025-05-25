import fs from "node:fs/promises";
import { XMLParser } from "fast-xml-parser";
import JSZip from "jszip";
import { parseXml } from "../xmlParser";

export interface EPubData {
  metadata: EPubMetadata;
  manifest: EPubManifestItem[];
  spine: EPubSpineItem[];
  toc: EPubTocItem[];
  chapters: EPubChapter[];
}

export interface EPubMetadata {
  title: string;
  author: string;
  language: string;
  publisher?: string;
  description?: string;
  rights?: string;
  identifiers: string[];
  date?: string;
}

export interface EPubManifestItem {
  id: string;
  href: string;
  mediaType: string;
  properties?: string[];
}

export interface EPubSpineItem {
  idref: string;
  linear: boolean;
}

export interface EPubTocItem {
  label: string;
  href: string;
  subItems?: EPubTocItem[];
}

export interface EPubChapter {
  id: string;
  href: string;
  title: string;
  content: string;
}

export interface EPubContainerXml {
  container?: {
    rootfiles?: {
      rootfile?: {
        "full-path": string;
      };
    };
  };
}

interface ManifestItemRaw {
  id: string;
  href: string;
  "media-type": string;
  properties?: string;
}

interface SpineItemRaw {
  idref: string;
  linear?: string;
}

export class EPubParser {
  private zip: JSZip;
  private xmlParser: XMLParser;

  constructor(zip: JSZip) {
    this.zip = zip;
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "",
      parseAttributeValue: true,
    });
  }

  /**
   * Read a file from the zip archive in the given mode. Throws if the file does
   * not exist so callers don't need to handle missing files.
   */
  private async readFileFromZip(
    filePath: string,
    mode: "text" | "uint8array" = "text",
  ): Promise<string | Uint8Array> {
    const file = this.zip.file(filePath);
    if (!file) {
      throw new Error(`Invalid epub: file ${filePath} not found`);
    }
    return file.async(mode);
  }

  static async load(filePath: string): Promise<EPubParser> {
    try {
      await fs.access(filePath);
      const rawZipData = await fs.readFile(filePath);

      // Basic validation - check for epub magic numbers
      // EPub files should start with "PK\x03\x04"
      if (
        !rawZipData ||
        rawZipData.length < 4 ||
        rawZipData[0] !== 0x50 || // P
        rawZipData[1] !== 0x4b || // K
        rawZipData[2] !== 0x03 ||
        rawZipData[3] !== 0x04
      ) {
        throw new Error("Invalid epub file");
      }

      const zip = await JSZip.loadAsync(rawZipData);
      return new EPubParser(zip);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new Error("File not found");
      }
      throw error;
    }
  }

  public async getContainerXml(): Promise<EPubContainerXml> {
    const containerFile = this.zip.file("META-INF/container.xml");
    if (!containerFile) {
      throw new Error("Invalid epub: missing container.xml");
    }

    const containerXml = await containerFile.async("text");
    return this.xmlParser.parse(containerXml) as EPubContainerXml;
  }

  public async getOpfPath(): Promise<string> {
    const container = await this.getContainerXml();
    const rootfile = container?.container?.rootfiles?.rootfile;

    if (!rootfile || !rootfile["full-path"]) {
      throw new Error("Invalid epub: cannot find OPF file path");
    }

    return rootfile["full-path"];
  }

  public async resolveFromOpf(href: string): Promise<string> {
    const opfPath = await this.getOpfPath();
    const opfDir = opfPath.split("/").slice(0, -1).join("/");
    return opfDir ? `${opfDir}/${href}` : href;
  }

  /**
   * Read the raw container.xml text.
   */
  public async readContainerXml(): Promise<string> {
    return this.readFileFromZip(
      "META-INF/container.xml",
      "text",
    ) as Promise<string>;
  }

  /**
   * Read the raw OPF document text.
   */
  public async readOpfXml(): Promise<string> {
    const opfPath = await this.getOpfPath();
    return this.readFileFromZip(opfPath, "text") as Promise<string>;
  }

  /**
   * Read a file referenced relative to the OPF document.
   */
  public async readFileFromOpf(href: string): Promise<string | null> {
    const resolved = await this.resolveFromOpf(href);
    const file = this.zip.file(resolved);
    return file ? await file.async("text") : null;
  }

  async metadata(): Promise<EPubMetadata> {
    const opfPath = await this.getOpfPath();
    const opfFile = this.zip.file(opfPath);

    if (!opfFile) {
      throw new Error("Invalid epub: missing OPF file");
    }

    const opfContent = await opfFile.async("text");
    const opfData = this.xmlParser.parse(opfContent);
    const metadata = opfData.package?.metadata;

    if (!metadata) {
      throw new Error("Invalid epub: missing metadata in OPF");
    }

    // Helper function to handle both single values and arrays
    const getValue = (field: unknown): string[] => {
      if (field === undefined || field === null) return [];
      if (Array.isArray(field)) {
        return field.map((item) => {
          if (typeof item === "object" && item !== null) {
            const text = (item as Record<string, unknown>)["#text"];
            return typeof text === "string" ? text : "";
          }
          return String(item);
        });
      }
      if (typeof field === "object") {
        const text = (field as Record<string, unknown>)["#text"];
        return [typeof text === "string" ? text : ""];
      }
      return [String(field)];
    };

    return {
      title: getValue(metadata["dc:title"])[0] || "",
      author: getValue(metadata["dc:creator"])[0] || "",
      language: getValue(metadata["dc:language"])[0] || "",
      publisher: getValue(metadata["dc:publisher"])[0],
      description: getValue(metadata["dc:description"])[0],
      rights: getValue(metadata["dc:rights"])[0],
      identifiers: getValue(metadata["dc:identifier"]),
      date: getValue(metadata["dc:date"])[0],
    };
  }

  async manifest(): Promise<EPubManifestItem[]> {
    const opfPath = await this.getOpfPath();
    const opfFile = this.zip.file(opfPath);

    if (!opfFile) {
      throw new Error("Invalid epub: missing OPF file");
    }

    const opfContent = await opfFile.async("text");
    const opfData = this.xmlParser.parse(opfContent);

    const manifest = opfData.package?.manifest;

    if (!manifest?.item) {
      throw new Error("Invalid epub: missing manifest in OPF");
    }

    const items: ManifestItemRaw[] = Array.isArray(manifest.item)
      ? (manifest.item as ManifestItemRaw[])
      : [manifest.item as ManifestItemRaw];

    return items.map((item) => ({
      id: String(item.id),
      href: String(item.href),
      mediaType: String(item["media-type"]),
      properties: item.properties?.split(" ") ?? undefined,
    }));
  }

  async spine(): Promise<EPubSpineItem[]> {
    const opfPath = await this.getOpfPath();
    const opfFile = this.zip.file(opfPath);

    if (!opfFile) {
      throw new Error("Invalid epub: missing OPF file");
    }

    const opfContent = await opfFile.async("text");
    const opfData = this.xmlParser.parse(opfContent);
    const spine = opfData.package?.spine;

    if (!spine?.itemref) {
      throw new Error("Invalid epub: missing spine in OPF");
    }

    const items: SpineItemRaw[] = Array.isArray(spine.itemref)
      ? (spine.itemref as SpineItemRaw[])
      : [spine.itemref as SpineItemRaw];

    return items.map((item) => ({
      idref: String(item.idref),
      linear: item.linear !== "no",
    }));
  }

  public async tocEPUB3(navItem: EPubManifestItem): Promise<EPubTocItem[]> {
    const navPath = await this.resolveFromOpf(navItem.href);
    const navFile = this.zip.file(navPath);

    if (!navFile) {
      throw new Error("Invalid epub: nav document not found");
    }

    const navContent = await navFile.async("text");
    // Parse the XML content
    const dom = parseXml(navContent);

    const tocNav =
      dom.querySelector('nav[epub\\:type~="toc"]') ||
      dom.querySelector('nav[epub:type~="toc"]');

    if (!tocNav) {
      throw new Error('Invalid epub: nav document missing [epub:type~="toc"]');
    }

    const walkList = (olElement: Element): EPubTocItem[] => {
      return Array.from(olElement.children).flatMap((li) => {
        const anchor = li.querySelector("a");
        if (!anchor) return [];

        const label = anchor.textContent.trim();
        const href = anchor.getAttribute("href") || "";

        const subOl = li.querySelector("ol");
        const subItems = subOl ? walkList(subOl) : [];

        return [{ label, href, subItems }];
      });
    };

    const ol = tocNav.querySelector("ol");
    if (!ol) {
      throw new Error("Invalid epub: nav TOC is missing an <ol> element");
    }

    return walkList(ol);
  }

  public async tocNCX(ncxItem: EPubManifestItem): Promise<EPubTocItem[]> {
    const ncxPath = await this.resolveFromOpf(ncxItem.href);
    const ncxFile = this.zip?.file(ncxPath);

    if (!ncxFile) {
      throw new Error("Invalid epub: NCX document not found");
    }

    const ncxContent = await ncxFile.async("text");
    const ncxData = this.xmlParser.parse(ncxContent);

    const navMap = ncxData.ncx?.navMap;
    if (!navMap?.navPoint) {
      throw new Error("Invalid epub: missing navigation points");
    }

    const parseNavPoints = (
      items: Record<string, unknown>[],
    ): EPubTocItem[] => {
      return items.map((item) => {
        const content = item.content as Record<string, unknown> | undefined;
        const href = (content?.src as string) || "";
        const navLabel = item.navLabel as Record<string, unknown> | undefined;
        const label = (navLabel?.text as string) || "";
        const navPoint = item.navPoint as unknown;
        const subItems = navPoint
          ? parseNavPoints(
              Array.isArray(navPoint)
                ? (navPoint as Record<string, unknown>[])
                : [navPoint as Record<string, unknown>],
            )
          : [];
        return { label, href, subItems };
      });
    };

    const navPoints = Array.isArray(navMap.navPoint)
      ? navMap.navPoint
      : [navMap.navPoint];
    return parseNavPoints(navPoints);
  }

  async toc(): Promise<EPubTocItem[]> {
    const manifest = await this.manifest();

    // Check for EPUB3 nav
    const navItem = manifest.find((item) => item.properties?.includes("nav"));
    if (navItem) {
      return this.tocEPUB3(navItem);
    }

    // Check for NCX
    const ncxItem = manifest.find(
      (item) => item.mediaType === "application/x-dtbncx+xml",
    );
    if (ncxItem) {
      return this.tocNCX(ncxItem);
    }

    throw new Error(
      "Invalid epub: no table of contents found (neither nav nor NCX)",
    );
  }

  async chapters(): Promise<EPubChapter[]> {
    const spine = await this.spine();
    const manifest = await this.manifest();
    const toc = await this.toc();

    // Map spine items to chapters using manifest and toc information
    const chapters = await Promise.all(
      spine.map(async (spineItem) => {
        // Find corresponding manifest item
        const manifestItem = manifest.find(
          (item) => item.id === spineItem.idref,
        );
        if (!manifestItem) {
          throw new Error(
            `Invalid epub: spine item ${spineItem.idref} not found in manifest`,
          );
        }

        // Find corresponding toc item
        const tocItem = this.findTocItem(toc, manifestItem.href);

        // Get chapter content
        const chapterPath = await this.resolveFromOpf(manifestItem.href);
        const chapterFile = this.zip.file(chapterPath);
        if (!chapterFile) {
          throw new Error(
            `Invalid epub: chapter file ${chapterPath} not found`,
          );
        }

        const content = await chapterFile.async("text");
        return {
          id: manifestItem.id,
          href: manifestItem.href,
          title: tocItem?.label || "",
          content,
        };
      }),
    );

    return chapters;
  }

  public findTocItem(
    items: EPubTocItem[],
    href: string,
  ): EPubTocItem | undefined {
    for (const item of items) {
      if (item.href.endsWith(href)) {
        return item;
      }
      if (item.subItems?.length) {
        const found = this.findTocItem(item.subItems, href);
        if (found) {
          return found;
        }
      }
    }
    return undefined;
  }

  async parse(): Promise<EPubData> {
    const metadata = await this.metadata();
    const manifest = await this.manifest();
    const spine = await this.spine();
    const toc = await this.toc();
    const chapters = await this.chapters();

    return {
      metadata,
      manifest,
      spine,
      toc,
      chapters,
    };
  }
}
