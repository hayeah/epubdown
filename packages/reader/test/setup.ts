import "@testing-library/jest-dom";
import "fake-indexeddb/auto";

// Mock DOMParser for Node.js environment
if (typeof DOMParser === "undefined") {
  global.DOMParser = class DOMParser {
    parseFromString(string: string, type: string) {
      const { JSDOM } = require("jsdom");
      const dom = new JSDOM(string, { contentType: type });
      return dom.window.document;
    }
  };
}

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor(
    private callback: IntersectionObserverCallback,
    private options?: IntersectionObserverInit,
  ) {}

  observe() {
    // Mock implementation
  }

  unobserve() {
    // Mock implementation
  }

  disconnect() {
    // Mock implementation
  }
} as any;
