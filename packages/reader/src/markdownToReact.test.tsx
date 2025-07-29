import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { markdownToReact } from "./markdownToReact";

// Mock the MarkdownComponents
vi.mock("./MarkdownComponents", () => ({
  Image: ({ src, alt }: any) =>
    React.createElement("img", { src, alt, "data-testid": "mock-image" }),
  Footnote: ({ children, href }: any) =>
    React.createElement(
      "a",
      { href, "data-testid": "mock-footnote" },
      children,
    ),
}));

describe("markdownToReact", () => {
  it("should not truncate content after x-image tags", async () => {
    const markdown = `
Text before image

<x-image src="test.jpg" alt="test image"></x-image>

Text after image that should not be truncated

Another paragraph here
`;

    const result = await markdownToReact(markdown);
    const html = renderToStaticMarkup(result as React.ReactElement);

    // Check that all content is present
    expect(html).toContain("Text before image");
    expect(html).toContain('data-testid="mock-image"');
    expect(html).toContain('src="test.jpg"');
    expect(html).toContain('alt="test image"');
    expect(html).toContain("Text after image that should not be truncated");
    expect(html).toContain("Another paragraph here");

    // Ensure content after image is not nested inside the image
    expect(html).toMatch(/<img[^>]*>.*Text after image/s);
  });

  it("should handle multiple x-image tags", async () => {
    const markdown = `
First paragraph

<x-image src="image1.jpg" alt="First"></x-image>

Middle paragraph

<x-image src="image2.jpg" alt="Second"></x-image>

Last paragraph
`;

    const result = await markdownToReact(markdown);
    const html = renderToStaticMarkup(result as React.ReactElement);

    expect(html).toContain("First paragraph");
    expect(html).toContain("Middle paragraph");
    expect(html).toContain("Last paragraph");
    expect(html).toContain('src="image1.jpg"');
    expect(html).toContain('src="image2.jpg"');
  });

  it("should handle x-footnote tags correctly", async () => {
    const markdown = `
Some text with a footnote<x-footnote href="#note1" id="ref1">1</x-footnote>.

More text here.
`;

    const result = await markdownToReact(markdown);
    const html = renderToStaticMarkup(result as React.ReactElement);

    expect(html).toContain("Some text with a footnote");
    expect(html).toContain('data-testid="mock-footnote"');
    expect(html).toContain('href="#note1"');
    expect(html).toContain(">1<");
    expect(html).toContain("More text here");
  });
});
