import { describe } from "vitest";
import { EPub } from "./Epub";
import { createTableOfContentsTests } from "./TableOfContents.test.shared";
import { fetchEpub } from "./testUtils/fetchEpub";

describe(
  "TableOfContents - Browser Tests",
  createTableOfContentsTests({
    createEpub: async () => {
      const epubData = await fetchEpub("alice.epub");
      return EPub.fromZip(epubData);
    },
  }),
);
