import { describe, expect, it } from "vitest";
import { DOMParser } from "./xmlParser";
import { createXmlParserTests } from "./xmlParser.test.shared";

describe("xmlParser - browser", createXmlParserTests(DOMParser));

describe("Browser environment verification", () => {
  it("should verify browser environment", () => {
    expect(typeof window).toBe("object");
    expect(typeof window.DOMParser).toBe("function");
  });

  it("should use native browser DOMParser", () => {
    // In browser environment, our DOMParser should be the native one
    expect(DOMParser).toBe(window.DOMParser);
  });
});
