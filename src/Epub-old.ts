// deps -----------------------------------------------------------------
import JSZip from "jszip";
import { DOMParser } from "linkedom"; // in a browser these are globals
import TurndownService from "turndown";

// util -----------------------------------------------------------------
const td = new TurndownService();

export async function openEpub(path: string): Promise<EPub> {
  const fs = await import("node:fs/promises");
  const data = (await fs.readFile(path)).buffer;
  return EPub.init(data as ArrayBuffer);
}

function parseXML(xml: string): XMLDocument {
  return new DOMParser().parseFromString(xml, "text/xml") as any;
}

// ----------------------------------------------------------------------
// EPub
// ----------------------------------------------------------------------
export class EPub {
  static async readZip(
    zip: JSZip,
    filepath: string,
  ): Promise<string | undefined> {
    return zip.file(filepath)?.async("string");
  }

  static async readZipDOM(
    zip: JSZip,
    filepath: string,
  ): Promise<XMLDocument | undefined> {
    const xml = await EPub.readZip(zip, filepath);
    return xml ? parseXML(xml) : undefined;
  }

  static async init(data: ArrayBuffer): Promise<EPub> {
    // Initialize the zip
    const zip = await JSZip.loadAsync(data);

    // 1. Read container.xml
    const containerDOM = await EPub.readZipDOM(zip, "META-INF/container.xml");
    if (!containerDOM) throw new Error("Missing container.xml");

    // 2. Find the OPF file
    const rootfile = containerDOM.querySelector("rootfile");
    if (!rootfile) throw new Error("No rootfile element in container.xml");
    const opfPath = rootfile.getAttribute("full-path");
    if (!opfPath) throw new Error("Missing full-path attribute in rootfile");
    const opfDir = opfPath.slice(0, opfPath.lastIndexOf("/") + 1);

    // 3. Read the OPF file
    const opfDOM = await EPub.readZipDOM(zip, opfPath);
    if (!opfDOM) throw new Error(`OPF file not found: ${opfPath}`);

    return new EPub(zip, containerDOM, opfDOM, opfDir);
  }

  constructor(
    private readonly zip: JSZip,
    private readonly containerDOM: XMLDocument,
    private readonly opfDOM: XMLDocument,
    private readonly opfDir: string,
  ) {}

  /** raw bytes (images, fonts…) */
  async readHrefRaw(href: string): Promise<Uint8Array | undefined> {
    const file = this.zip.file(href);
    return file?.async("uint8array");
  }

  /** decoded text */
  async readHref(href: string): Promise<string | undefined> {
    const file = this.zip.file(href);
    return file?.async("string");
  }

  // --------------------------------------------------------------------
  // toc helpers
  // --------------------------------------------------------------------
  private async pickToc(): Promise<Nav | NCX | null> {
    const manifest = this.opfDOM.querySelectorAll("manifest > item");

    // a. EPUB 3 navigation document
    for (const item of manifest) {
      if (item.getAttribute("properties")?.includes("nav")) {
        const href = item.getAttribute("href")!;
        const navStr = await this.readHref(href);
        return new Nav(navStr, this.opfDir, this.zip);
      }
    }

    // b. fallback to NCX
    for (const item of manifest) {
      if (
        item.getAttribute("media-type") === "application/x-dtbncx+xml" ||
        item.getAttribute("href")?.endsWith(".ncx")
      ) {
        const href = item.getAttribute("href")!;
        const ncxStr = await this.readHref(href);
        return new NCX(ncxStr, this.opfDir, this.zip);
      }
    }

    return null;
  }
}

// ----------------------------------------------------------------------
// Nav (EPUB 3)
// ----------------------------------------------------------------------
export class Nav {
  private dom: Document;

  constructor(
    xhtml: string,
    private opfDir: string,
    private zip: JSZip,
  ) {
    this.dom = new DOMParser().parseFromString(xhtml, "application/xhtml+xml");
  }

  /** chapter list: [{title, href}] */
  get items(): { title: string; href: string }[] {
    const anchors = this.dom.querySelectorAll(
      "nav[epub|type='toc'] a, nav[type='toc'] a",
    );
    return Array.from(anchors, (a: Element) => {
      const href = a.getAttribute("href");
      if (!href) throw new Error("Missing href in TOC item");
      return {
        title: a.textContent?.trim() ?? "",
        href,
      };
    });
  }
}

// ----------------------------------------------------------------------
// NCX (EPUB 2)
// ----------------------------------------------------------------------
export class NCX {
  private dom: Document;

  constructor(
    xml: string,
    private opfDir: string,
    private zip: JSZip,
  ) {
    this.dom = new DOMParser().parseFromString(xml, "application/xml");
  }

  /** chapter list: [{title, href}] */
  get items(): { title: string; href: string }[] {
    const points = this.dom.querySelectorAll("navPoint");
    return Array.from(points, (p: Element) => {
      const text = p.querySelector("text")?.textContent?.trim() ?? "";
      const src = p.querySelector("content")?.getAttribute("src");
      if (!src) throw new Error("Missing src in NCX navPoint");
      return { title: text, href: src };
    });
  }
}
