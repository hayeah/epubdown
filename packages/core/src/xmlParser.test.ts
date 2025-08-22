import { describe, expect, it } from "vitest";
import { DOMParser, parseDocument } from "./xmlParser";
import { createXmlParserTests } from "./xmlParser.test.shared";

describe("xmlParser - jsdom", createXmlParserTests(DOMParser));

describe("parseDocument function", () => {
  it("should handle nbsp entities in XHTML mode by replacing them with spaces", () => {
    const xhtml = `<?xml version="1.0"?>
      <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" 
        "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
      <html xmlns="http://www.w3.org/1999/xhtml">
        <head>
          <title>Test</title>
        </head>
        <body>
          <p>Text with&nbsp;non-breaking&nbsp;spaces</p>
          <p>Another&nbsp;test</p>
        </body>
      </html>`;

    // Using parseDocument with xhtml content type should handle nbsp entities
    const doc = parseDocument(xhtml, "xhtml");

    // Should not have parser errors
    const parserError = doc.querySelector("parsererror");
    expect(parserError).toBeNull();

    // Content should be parsed correctly with spaces replacing nbsp
    const paragraphs = doc.querySelectorAll("p");
    expect(paragraphs.length).toBe(2);
    expect(paragraphs[0]?.textContent).toBe("Text with non-breaking spaces");
    expect(paragraphs[1]?.textContent).toBe("Another test");
  });

  it("should clean style and script tags to prevent CSS parsing errors", () => {
    const xhtml = `<?xml version="1.0"?>
      <html xmlns="http://www.w3.org/1999/xhtml">
        <head>
          <title>Test</title>
          <style>@page { margin: 2em; }</style>
          <script>console.log("test");</script>
        </head>
        <body>
          <p>Content</p>
        </body>
      </html>`;

    const doc = parseDocument(xhtml, "xhtml");

    // Should not have parser errors
    const parserError = doc.querySelector("parsererror");
    expect(parserError).toBeNull();

    // Style and script tags should be removed
    expect(doc.querySelector("style")).toBeNull();
    expect(doc.querySelector("script")).toBeNull();

    // Content should still be there
    const p = doc.querySelector("p");
    expect(p?.textContent).toBe("Content");
  });
});
