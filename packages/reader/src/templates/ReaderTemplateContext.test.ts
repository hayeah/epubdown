import { describe, expect, it, vi } from "vitest";
import { ReaderTemplateContext } from "./ReaderTemplateContext";
import { Template } from "./Template";

describe("ReaderTemplateContext", () => {
  it("should render timestamp method correctly in template", async () => {
    // Mock dependencies
    const mockReader = {
      metadata: { title: "Test Book" },
      currentChapterTitle: "Chapter 1",
    };
    const mockPalette = {
      savedRange: null,
    };

    const ctx = new ReaderTemplateContext(
      mockReader as any,
      mockPalette as any,
    );

    // Create a template that uses the getTimestamp method
    const template = new Template(
      "test",
      "Test",
      "Captured: {{ getTimestamp }}",
    );

    // Mock Date to get consistent output
    const mockDate = new Date("2024-01-01T12:00:00.000Z");
    vi.spyOn(global, "Date").mockImplementation(() => mockDate as any);

    const result = await template.render(ctx);
    expect(result).toBe("Captured: 2024-01-01T12:00:00.000Z");

    vi.restoreAllMocks();
  });

  it("should handle all context properties", async () => {
    const mockReader = {
      metadata: {
        title: "My Book",
        creator: "John Doe",
      },
      currentChapterTitle: "Introduction",
    };
    const mockPalette = {
      savedRange: {
        toString: () => "selected text",
      },
    };

    const ctx = new ReaderTemplateContext(
      mockReader as any,
      mockPalette as any,
    );

    const template = new Template(
      "full",
      "Full Template",
      "Book: {{ bookTitle }}\nAuthor: {{ bookAuthor }}\nChapter: {{ chapterTitle }}\nText: {{ selectionText }}\nTime: {{ getTimestamp }}",
    );

    // Mock Date
    const mockDate = new Date("2024-01-01T12:00:00.000Z");
    vi.spyOn(global, "Date").mockImplementation(() => mockDate as any);

    const result = await template.render(ctx);
    expect(result).toContain("Book: My Book");
    expect(result).toContain("Author: John Doe");
    expect(result).toContain("Chapter: Introduction");
    expect(result).toContain("Text: selected text");
    expect(result).toContain("Time: 2024-01-01T12:00:00.000Z");

    vi.restoreAllMocks();
  });
});
