import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { EPub } from "./Epub";
import type { TableOfContents } from "./TableOfContents";
import { compareOrUpdateFixture, fetchEpub } from "./testUtils";

describe("TableOfContents", () => {
  let epub: EPub;
  let toc: TableOfContents;

  beforeEach(async () => {
    const epubData = await fetchEpub("alice.epub");
    epub = await EPub.fromZip(epubData);
    toc = epub.toc;
  });

  describe("navItems", () => {
    it("should parse navigation items from Alice EPUB", async () => {
      const navItems = await toc.navItems();

      // Compare against fixture
      const fixturePath = path.join(
        __dirname,
        "fixtures",
        "alice-tocNavItems.json",
      );
      compareOrUpdateFixture(fixturePath, navItems);
    });

    it("should handle nested navigation if present", async () => {
      const navItems = await toc.navItems();

      // Check if any items have subitems
      const itemsWithSubitems = navItems.filter(
        (item) => item.subitems && item.subitems.length > 0,
      );

      // If there are nested items, verify their structure
      if (itemsWithSubitems.length > 0) {
        const parentItem = itemsWithSubitems[0];
        expect(parentItem.subitems).toBeDefined();
        expect(parentItem.subitems?.length).toBeGreaterThan(0);

        // Verify subitem structure
        if (parentItem.subitems) {
          for (const subitem of parentItem.subitems) {
            expect(subitem).toHaveProperty("href");
            expect(subitem).toHaveProperty("label");
            // id is optional, parsed from href fragment if present
            if (subitem.href.includes("#")) {
              expect(subitem).toHaveProperty("id");
            }
          }
        }
      }
    });
  });

  describe("flat", () => {
    it("should flatten navigation structure from Alice EPUB", async () => {
      const flatToc = await toc.flatNavItems();

      // Compare against fixture
      const fixturePath = path.join(
        __dirname,
        "fixtures",
        "alice-tocFlat.json",
      );
      compareOrUpdateFixture(fixturePath, flatToc);
    });

    it("should maintain hierarchy in flattened structure", async () => {
      const navItems = await toc.navItems();
      const flatToc = await toc.flatNavItems();

      // Count total items including nested ones
      const countItems = (items: typeof navItems): number => {
        return items.reduce((count, item) => {
          return count + 1 + (item.subitems ? countItems(item.subitems) : 0);
        }, 0);
      };

      const totalNavItems = countItems(navItems);
      expect(flatToc.length).toBe(totalNavItems);

      // Verify ordering - parent always comes before children
      for (let i = 0; i < flatToc.length; i++) {
        const item = flatToc[i];
        if (item.parentHref) {
          const parentIndex = flatToc.findIndex(
            (p) => p.href === item.parentHref,
          );
          expect(parentIndex).toBeGreaterThanOrEqual(0);
          expect(parentIndex).toBeLessThan(i);
        }
      }
    });

    it("should have correct parent-child relationships", async () => {
      const flatToc = await toc.flatNavItems();

      // Verify parent references are correct
      for (const item of flatToc) {
        if (item.parentHref) {
          // Parent should exist in the flat list
          const parentItem = flatToc.find((i) => i.href === item.parentHref);
          expect(parentItem).toBeDefined();
          // Child's level should be parent's level + 1
          if (parentItem) {
            expect(item.level).toBe(parentItem.level + 1);
          }
        } else {
          // Items without parents should be at level 0
          expect(item.level).toBe(0);
        }
      }
    });
  });

  describe("html", () => {
    it("should return HTML representation of TOC", async () => {
      const htmlToc = await toc.html();

      expect(htmlToc).toBeDefined();
      expect(htmlToc?.content).toContain("<nav");
      expect(htmlToc?.content).toContain('epub:type="toc"');

      // Should have links
      const navElement = htmlToc?.querySelector('nav[epub\\:type="toc"]');
      const links = navElement?.querySelectorAll("a");
      expect(links?.length).toBeGreaterThan(0);
    });
  });

  describe("anchorLinks", () => {
    it("should extract anchor links from TOC", async () => {
      const anchorLinks = await toc.anchorLinks();

      expect(anchorLinks).toBeInstanceOf(Map);

      // Alice EPUB has anchors in its TOC
      let totalAnchors = 0;
      for (const anchors of anchorLinks.values()) {
        totalAnchors += anchors.size;
      }
      expect(totalAnchors).toBeGreaterThan(0);
    });
  });
});
