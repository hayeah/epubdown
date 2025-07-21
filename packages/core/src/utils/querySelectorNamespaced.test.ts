import { describe } from "vitest";
import { parseHtml, parseXml } from "../xmlParser";
import { createQuerySelectorNamespacedTests } from "./querySelectorNamespaced.test.shared";

describe(
  "querySelectorNamespaced - jsdom",
  createQuerySelectorNamespacedTests(parseXml, parseHtml),
);
