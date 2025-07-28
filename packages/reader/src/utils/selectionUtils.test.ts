import { JSDOM } from "jsdom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  formatSelectionWithContext,
  getSelectionContext,
} from "./selectionUtils";

describe("selectionUtils", () => {
  let dom: JSDOM;
  let document: Document;
  let window: Window & typeof globalThis;

  beforeEach(() => {
    dom = new JSDOM(
      `
      <!DOCTYPE html>
      <html>
        <body>
          <article class="epub-chapter">
            <p id="p1">This is the first paragraph with some text content.</p>
            <p id="p2">The quick brown fox jumps over the lazy dog.</p>
            <p id="p3">Here is the <span id="target">selected text</span> in the middle.</p>
            <p id="p4">And this is the last paragraph with more content to extract.</p>
          </article>
        </body>
      </html>
    `,
      { url: "http://localhost" },
    );

    document = dom.window.document;
    window = dom.window as any;

    // Mock window.getSelection globally
    global.window = window as any;
    global.document = document as any;
    global.Node = dom.window.Node as any;
    global.NodeFilter = dom.window.NodeFilter as any;
    global.TreeWalker = dom.window.TreeWalker as any;
  });

  afterEach(() => {
    dom.window.close();
  });

  describe("getSelectionContext", () => {
    it("should extract context before and after selection", () => {
      // Create a selection
      const selection = window.getSelection()!;
      const targetSpan = document.getElementById("target")!;
      const range = document.createRange();
      range.selectNodeContents(targetSpan);
      selection.removeAllRanges();
      selection.addRange(range);

      const context = getSelectionContext(selection, 20);

      expect(context.selectedText).toBe("selected text");
      expect(context.beforeContext).toContain("Here is the");
      expect(context.afterContext).toContain("in the middle");
    });

    it("should extract context across multiple paragraphs", () => {
      // Select text spanning from p2 to p3
      const selection = window.getSelection()!;
      const p2 = document.getElementById("p2")!;
      const p3 = document.getElementById("p3")!;
      const range = document.createRange();

      // Start in middle of p2
      range.setStart(p2.firstChild!, 10); // After "The quick "
      // End in middle of p3
      range.setEnd(p3.firstChild!, 12); // After "Here is the "

      selection.removeAllRanges();
      selection.addRange(range);

      const context = getSelectionContext(selection, 30);

      // The selection spans across paragraphs, so it includes the text between them
      expect(context.selectedText).toContain(
        "brown fox jumps over the lazy dog.",
      );
      expect(context.selectedText).toContain("Here is the");
      expect(context.beforeContext).toContain("The quick");
      expect(context.afterContext).toContain("selected text");
    });

    it("should handle selections at the beginning of content", () => {
      // Select at the very beginning
      const selection = window.getSelection()!;
      const p1 = document.getElementById("p1")!;
      const range = document.createRange();
      range.setStart(p1.firstChild!, 0);
      range.setEnd(p1.firstChild!, 4); // "This"
      selection.removeAllRanges();
      selection.addRange(range);

      const context = getSelectionContext(selection, 20);

      expect(context.selectedText).toBe("This");
      expect(context.beforeContext).toBe("");
      expect(context.afterContext).toContain("is the first paragraph");
    });

    it("should handle selections at the end of content", () => {
      // Select at the very end
      const selection = window.getSelection()!;
      const p4 = document.getElementById("p4")!;
      const text = p4.firstChild?.textContent!;
      const range = document.createRange();
      range.setStart(p4.firstChild!, text.length - 8); // "extract."
      range.setEnd(p4.firstChild!, text.length);
      selection.removeAllRanges();
      selection.addRange(range);

      const context = getSelectionContext(selection, 20);

      expect(context.selectedText).toBe("extract.");
      expect(context.beforeContext).toContain("with more content to");
      expect(context.afterContext).toBe("");
    });

    it("should dynamically allocate context when one side is limited", () => {
      // Create content with very little before, lots after
      dom = new JSDOM(
        `
        <article class="epub-chapter">
          <p>Short. <span id="target">Selected</span> but there is a lot of text after this that continues on and on with many more words available.</p>
        </article>
      `,
        { url: "http://localhost" },
      );

      document = dom.window.document;
      window = dom.window as any;

      const selection = window.getSelection()!;
      const targetSpan = document.getElementById("target")!;
      const range = document.createRange();
      range.selectNodeContents(targetSpan);
      selection.removeAllRanges();
      selection.addRange(range);

      const context = getSelectionContext(selection, 20);

      expect(context.selectedText).toBe("Selected");
      expect(context.beforeContext).toBe("Short.");
      // Should get more than 10 words after since before is limited
      const afterWords = context.afterContext.split(/\s+/).length;
      expect(afterWords).toBeGreaterThan(10);
    });

    it("should respect word limits", () => {
      // Create content with many words
      const longText = "word ".repeat(100);
      dom = new JSDOM(
        `
        <article class="epub-chapter">
          <p>${longText}<span id="target">SELECTED</span>${longText}</p>
        </article>
      `,
        { url: "http://localhost" },
      );

      document = dom.window.document;
      window = dom.window as any;

      const selection = window.getSelection()!;
      const targetSpan = document.getElementById("target")!;
      const range = document.createRange();
      range.selectNodeContents(targetSpan);
      selection.removeAllRanges();
      selection.addRange(range);

      const wordLimit = 20;
      const context = getSelectionContext(selection, wordLimit);

      expect(context.selectedText).toBe("SELECTED");

      const beforeWords = context.beforeContext
        .split(/\s+/)
        .filter((w) => w.length > 0).length;
      const afterWords = context.afterContext
        .split(/\s+/)
        .filter((w) => w.length > 0).length;

      expect(beforeWords).toBeLessThanOrEqual(wordLimit / 2 + 5); // Some tolerance
      expect(afterWords).toBeLessThanOrEqual(wordLimit / 2 + 5);
      expect(beforeWords + afterWords).toBeLessThanOrEqual(wordLimit + 5);
    });
  });

  describe("formatSelectionWithContext", () => {
    it("should format the selection with context correctly", () => {
      const context = {
        beforeContext: "This is before",
        selectedText: "the selection",
        afterContext: "and this is after",
      };

      const formatted = formatSelectionWithContext("Test Book", context);

      expect(formatted).toContain("Book Title: Test Book");
      expect(formatted).toContain("## Context");
      expect(formatted).toContain(
        "This is before <<the selection>> and this is after",
      );
      expect(formatted).toContain("## Selection");
      expect(formatted).toContain("the selection");
    });

    it("should wrap long lines at 80 characters", () => {
      const context = {
        beforeContext:
          "This is a very long piece of text that contains many words and will definitely need to be wrapped",
        selectedText: "the important selection that we want to highlight",
        afterContext:
          "followed by more text that continues on and on with many more words that should also be wrapped properly",
      };

      const formatted = formatSelectionWithContext("Test Book", context);

      // Check that lines are wrapped
      const lines = formatted.split("\n");
      for (const line of lines) {
        expect(line.length).toBeLessThanOrEqual(80);
      }

      // Verify content is preserved
      expect(formatted).toContain(
        "<<the important selection that we want to highlight>>",
      );
    });
  });
});
