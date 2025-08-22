import { describe, expect, it } from "vitest";
import { parseDocument } from "../xmlParser";
import { createQuerySelectorNamespacedTests } from "./querySelectorNamespaced.test.shared";

describe(
  "querySelectorNamespaced - browser",
  createQuerySelectorNamespacedTests(
    (xml: string) => parseDocument(xml, "xml"),
    (html: string) => parseDocument(html, "html"),
  ),
);

describe("Browser environment", () => {
  it("should verify browser environment", () => {
    expect(typeof window).toBe("object");
    expect(typeof window.DOMParser).toBe("function");
  });
});
