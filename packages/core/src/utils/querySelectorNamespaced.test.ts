import { describe } from "vitest";
import { parseDocument } from "../xmlParser";
import { createQuerySelectorNamespacedTests } from "./querySelectorNamespaced.test.shared";

describe(
  "querySelectorNamespaced - jsdom",
  createQuerySelectorNamespacedTests(
    (xml: string) => parseDocument(xml, "xml"),
    (html: string) => parseDocument(html, "html"),
  ),
);
