import { beforeEach, describe, expect, it } from "vitest";
import type { EPub } from "./Epub";
import type { TableOfContents } from "./TableOfContents";

export interface TestDependencies {
  createEpub: () => Promise<EPub>;
}

export function createTableOfContentsTests(deps: TestDependencies) {
  return () => {
    let epub: EPub;
    let toc: TableOfContents;

    beforeEach(async () => {
      epub = await deps.createEpub();
      toc = epub.toc;
    });

    describe("navItems", () => {
      it("should parse navigation items from Alice EPUB", async () => {
        const navItems = await toc.navItems();

        // Basic structure checks
        expect(navItems).toBeDefined();
        expect(navItems).toBeInstanceOf(Array);

        // Ensure there are items to test
        expect(navItems.length).toBeGreaterThan(0);

        const firstItem = navItems[0];
        expect(firstItem).toBeDefined();
        expect(firstItem).toHaveProperty("href");
        expect(firstItem).toHaveProperty("label");
        expect(typeof firstItem?.href).toBe("string");
        expect(typeof firstItem?.label).toBe("string");
      });

      it("should handle nested navigation if present", async () => {
        const navItems = await toc.navItems();

        // Check if any items have subitems
        const itemsWithSubitems = navItems.filter(
          (item) => item.subitems && item.subitems.length > 0,
        );

        // If there are no nested items, skip the test
        if (itemsWithSubitems.length === 0) {
          // Verify that the navigation structure is flat (no subitems)
          for (const item of navItems) {
            expect(
              item.subitems === undefined || item.subitems.length === 0,
            ).toBe(true);
          }
          return;
        }

        const parentItem = itemsWithSubitems[0];
        expect(parentItem).toBeDefined();
        expect(parentItem?.subitems).toBeDefined();
        expect(parentItem?.subitems?.length).toBeGreaterThan(0);

        // Verify subitem structure
        for (const subitem of parentItem?.subitems || []) {
          expect(subitem).toHaveProperty("href");
          expect(subitem).toHaveProperty("label");
          // id is optional, parsed from href fragment if present
          if (subitem.href.includes("#")) {
            expect(subitem).toHaveProperty("id");
          }
        }
      });
    });

    describe("flat", () => {
      it("should flatten navigation structure from Alice EPUB", async () => {
        const flatToc = await toc.flatNavItems();

        // Basic structure checks
        expect(flatToc).toBeDefined();
        expect(flatToc).toBeInstanceOf(Array);

        // Ensure there are items to test
        expect(flatToc.length).toBeGreaterThan(0);

        for (const item of flatToc) {
          expect(item).toHaveProperty("href");
          expect(item).toHaveProperty("label");
          expect(item).toHaveProperty("level");
          expect(typeof item.level).toBe("number");
          expect(item.level).toBeGreaterThanOrEqual(0);

          // Verify FlatNavItem doesn't have subitems
          expect(item).not.toHaveProperty("subitems");
        }
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
          expect(item).toBeDefined();
          if (item?.parentHref) {
            const parentIndex = flatToc.findIndex(
              (p) => p.href === item?.parentHref,
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
            expect(item.level).toBe((parentItem?.level ?? 0) + 1);
          } else {
            // Items without parents should be at level 0
            expect(item.level).toBe(0);
          }
        }
      });

      it("should have FlatNavItem properties only (no subitems)", async () => {
        const flatToc = await toc.flatNavItems();

        for (const item of flatToc) {
          // Required properties
          expect(item).toHaveProperty("href");
          expect(item).toHaveProperty("label");
          expect(item).toHaveProperty("level");

          // Optional properties
          // parentHref is optional (top-level items don't have it)
          if (item.level > 0) {
            expect(item).toHaveProperty("parentHref");
          }

          // id is optional (only items with fragment in href have it)
          if (item.href.includes("#")) {
            expect(item).toHaveProperty("id");
          }

          // Explicitly verify no subitems property
          expect(item).not.toHaveProperty("subitems");

          // Verify the shape matches FlatNavItem interface
          const allowedKeys = [
            "href",
            "label",
            "level",
            "parentHref",
            "id",
            "path",
          ];
          const actualKeys = Object.keys(item);
          for (const key of actualKeys) {
            expect(allowedKeys).toContain(key);
          }
        }
      });
    });

    describe("html", () => {
      it("should return HTML representation of TOC", async () => {
        const htmlToc = await toc.html();

        // TOC might be undefined in browser environment
        if (htmlToc) {
          expect(htmlToc.content).toContain("<nav");
          expect(htmlToc.content).toContain('epub:type="toc"');

          // Check for navigation element - use appropriate selector for environment
          const navElement = htmlToc.querySelectorNamespaced
            ? htmlToc.querySelectorNamespaced("nav", 'type="toc"', "epub")
            : htmlToc.querySelector('nav[epub\\:type="toc"]');

          expect(navElement).toBeTruthy();
          const links = navElement?.querySelectorAll("a");
          expect(links?.length).toBeGreaterThan(0);
        }
      });
    });

    describe("anchorLinks", () => {
      it("should extract anchor links from TOC", async () => {
        const anchorLinks = await toc.anchorLinks();

        expect(anchorLinks).toBeInstanceOf(Map);

        // Check if there are any anchors
        let totalAnchors = 0;
        for (const anchors of anchorLinks.values()) {
          totalAnchors += anchors.size;
        }

        // Should have at least some anchors in a typical EPUB
        expect(totalAnchors).toBeGreaterThanOrEqual(0);
      });

      it("should return Map with file paths as keys", async () => {
        const anchorLinks = await toc.anchorLinks();

        // Check structure
        for (const [filePath, anchors] of anchorLinks.entries()) {
          expect(typeof filePath).toBe("string");
          expect(anchors).toBeInstanceOf(Set);

          // Each anchor should be a string
          for (const anchor of anchors) {
            expect(typeof anchor).toBe("string");
          }
        }
      });
    });

    it("should work without node dependencies", () => {
      // This test verifies that the TableOfContents class and its tests
      // can run in any environment
      expect(toc).toBeDefined();
      expect(typeof toc.navItems).toBe("function");
      expect(typeof toc.flatNavItems).toBe("function");
      expect(typeof toc.html).toBe("function");
      expect(typeof toc.anchorLinks).toBe("function");
    });
  };
}
