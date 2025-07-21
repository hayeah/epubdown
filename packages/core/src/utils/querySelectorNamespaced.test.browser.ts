import { describe, expect, it } from "vitest";
import { parseHtml, parseXml } from "../xmlParser";
import { createQuerySelectorNamespacedTests } from "./querySelectorNamespaced.test.shared";

describe(
  "querySelectorNamespaced - browser",
  createQuerySelectorNamespacedTests(parseXml, parseHtml),
);

describe("Browser environment", () => {
  it("should verify browser environment", () => {
    expect(typeof window).toBe("object");
    expect(typeof window.DOMParser).toBe("function");
  });
});
