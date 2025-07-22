import { join } from "node:path";
import type { EPub } from "./Epub";
import { XMLFile } from "./XMLFile";
import { parseXml } from "./xmlParser";

export interface NavItem {
  id?: string;
  href: string;
  label: string;
  subitems?: NavItem[];
}

export interface FlatNavItem extends NavItem {
  level: number;
  parentHref?: string;
}

export class TableOfContents {
  constructor(private readonly epub: EPub) {}

  /**
   * Get the table of contents as HTML
   * First checks for EPUB3 nav document, then falls back to NCX converted to HTML
   */
  async html(): Promise<XMLFile | undefined> {
    // First check for EPUB3 nav document
    const navFile = await this.nav();
    if (navFile) {
      return navFile;
    }

    // Otherwise try to convert NCX to HTML
    return await this.ncxToHTML();
  }

  /**
   * Get EPUB3 navigation document
   */
  async nav(): Promise<XMLFile | undefined> {
    const manifest = this.epub.opf.querySelector("manifest");
    if (!manifest) return undefined;

    const navItem = manifest.querySelector('item[properties~="nav"]');
    if (!navItem) return undefined;

    const href = navItem.getAttribute("href");
    if (!href) return undefined;

    return this.epub.opf.readXMLFile(href);
  }

  /**
   * Get EPUB2 NCX document
   */
  async ncx(): Promise<XMLFile | undefined> {
    const manifest = this.epub.opf.querySelector("manifest");
    if (!manifest) return undefined;

    const ncxItem = manifest.querySelector(
      'item[media-type="application/x-dtbncx+xml"]',
    );
    if (!ncxItem) return undefined;

    const href = ncxItem.getAttribute("href");
    if (!href) return undefined;

    return this.epub.opf.readXMLFile(href);
  }

  /**
   * Convert NCX to HTML navigation format
   */
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
    const html = `<nav xmlns:epub="http://www.idpf.org/2007/ops" epub:type="toc">\n${olMarkup}\n</nav>`;

    return new XMLFile(
      ncxFile.base,
      "ncx.xml.html",
      html,
      parseXml(html) as XMLDocument,
      ncxFile.resolver,
    );
  }

  /**
   * Parse the table of contents and return nested navigation items
   */
  async navItems(): Promise<NavItem[]> {
    const tocFile = await this.html();
    if (!tocFile) {
      return [];
    }

    // Parse the nav element using browser-compatible selector
    const navElement = tocFile.querySelectorNamespaced(
      "nav",
      'type="toc"',
      "epub",
    );
    if (!navElement) {
      return [];
    }

    const parseNavList = (listElement: Element): NavItem[] => {
      const items = Array.from(listElement.querySelectorAll(":scope > li"));
      const navItems: NavItem[] = [];

      for (const item of items) {
        const link = item.querySelector(":scope > a");
        if (!link) continue;

        const href = link.getAttribute("href") || "";
        const label = link.textContent?.trim() || "";

        // Parse id from href fragment
        const fragmentIndex = href.indexOf("#");
        const id =
          fragmentIndex !== -1 ? href.substring(fragmentIndex + 1) : undefined;

        // Create the nav item
        const navItem: NavItem = {
          href,
          label,
        };

        if (id) {
          navItem.id = id;
        }

        // Check for nested list and parse recursively
        const nestedList = item.querySelector(":scope > ul, :scope > ol");
        if (nestedList) {
          navItem.subitems = parseNavList(nestedList);
        }

        navItems.push(navItem);
      }

      return navItems;
    };

    // Find the main list (ol or ul) within the nav element
    const mainList = navElement.querySelector(":scope > ol, :scope > ul");
    if (mainList) {
      return parseNavList(mainList);
    }

    return [];
  }

  /**
   * Parse the table of contents and return a flattened array of navigation items
   * Each item includes its hierarchical level and parent reference
   */
  async flatNavItems(): Promise<FlatNavItem[]> {
    const navItems = await this.navItems();

    const flattenNavItems = (
      items: NavItem[],
      level = 0,
      parentHref?: string,
    ): FlatNavItem[] => {
      return items.reduce<FlatNavItem[]>((acc, item) => {
        const flatItem: FlatNavItem = {
          ...item,
          level,
          parentHref,
        };

        acc.push(flatItem);

        if (item.subitems && item.subitems.length > 0) {
          // Use the item's href as parent for subitems
          acc.push(...flattenNavItems(item.subitems, level + 1, item.href));
        }

        return acc;
      }, []);
    };

    return flattenNavItems(navItems);
  }

  /**
   * Extract all anchor links from the table of contents
   * Returns a Map where keys are resolved file paths and values are Sets of anchor IDs
   * Results are memoized for performance
   */
  async anchorLinks(): Promise<Map<string, Set<string>>> {
    const tocFile = await this.html();
    if (!tocFile) {
      return new Map();
    }

    const anchorMap = new Map<string, Set<string>>();

    // Find all links in the TOC using browser-compatible selector
    const navElement = tocFile.querySelectorNamespaced(
      "nav",
      'type="toc"',
      "epub",
    );
    if (!navElement) {
      return new Map();
    }
    const links = navElement.querySelectorAll("a[href]");

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

    return anchorMap;
  }
}
