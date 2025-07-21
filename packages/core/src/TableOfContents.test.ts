import path from "node:path";
import { beforeEach, describe, it } from "vitest";
import { EPub } from "./Epub";
import type { TableOfContents } from "./TableOfContents";
import { createTableOfContentsTests } from "./TableOfContents.test.shared";
import { compareOrUpdateFixture, fetchEpub } from "./testUtils";

// Shared tests
describe(
  "TableOfContents",
  createTableOfContentsTests({
    createEpub: async () => {
      const epubData = await fetchEpub("alice.epub");
      return EPub.fromZip(epubData);
    },
  }),
);

// Fixture-specific tests for jsdom environment
describe("TableOfContents - Fixture Tests", () => {
  let epub: EPub;
  let toc: TableOfContents;

  beforeEach(async () => {
    const epubData = await fetchEpub("alice.epub");
    epub = await EPub.fromZip(epubData);
    toc = epub.toc;
  });

  it("should match navItems fixture", async () => {
    const navItems = await toc.navItems();
    const fixturePath = path.join(
      __dirname,
      "fixtures",
      "alice-tocNavItems.json",
    );
    compareOrUpdateFixture(fixturePath, navItems);
  });

  it("should match flatNavItems fixture", async () => {
    const flatToc = await toc.flatNavItems();
    const fixturePath = path.join(__dirname, "fixtures", "alice-tocFlat.json");
    compareOrUpdateFixture(fixturePath, flatToc);
  });
});
