import type { XMLFile } from "@epubdown/core";
import { render, screen, waitFor } from "@testing-library/react";
import type React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as RootStore from "../stores/RootStore";
import { Image } from "./Image";

// Mock ReaderStore
function createMockReaderStore(getImageResult?: string) {
  const mockChapter: Partial<XMLFile> = {
    readRaw: vi.fn(),
    base: "/test",
    name: "test.xhtml",
    path: "/test/test.xhtml",
  };

  const mockStore = {
    currentChapter: mockChapter as XMLFile,
    getImage: vi.fn().mockImplementation(async () => {
      if (!getImageResult) {
        throw new Error("Image not found");
      }
      return getImageResult;
    }),
  };

  return mockStore;
}

// Helper to render Image with mocked store
function renderImage(
  props: React.ComponentProps<typeof Image>,
  imageDataUrl?: string,
) {
  const mockStore = createMockReaderStore(imageDataUrl);
  vi.spyOn(RootStore, "useReaderStore").mockReturnValue(mockStore as any);

  return render(<Image {...props} />);
}

// Helper to create a base64 data URL from Uint8Array
function createDataUrl(data: Uint8Array, mimeType: string): string {
  const base64 = btoa(
    Array.from(data).reduce(
      (result, byte) => result + String.fromCharCode(byte),
      "",
    ),
  );
  return `data:${mimeType};base64,${base64}`;
}

describe("Image Component", () => {
  beforeEach(() => {
    // Reset any global mocks before each test
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up after each test
    vi.restoreAllMocks();
  });

  it("renders loading state initially", () => {
    renderImage({ src: "test.jpg" });
    expect(screen.getByText("Image")).toBeInTheDocument();
  });

  it("loads and displays image when in viewport", async () => {
    // Create mock image data (a simple 1x1 red pixel PNG)
    const mockImageData = new Uint8Array([
      137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1,
      0, 0, 0, 1, 8, 2, 0, 0, 0, 144, 119, 83, 222, 0, 0, 0, 12, 73, 68, 65, 84,
      8, 153, 99, 248, 15, 0, 0, 1, 1, 0, 5, 254, 12, 240, 0, 0, 0, 0, 73, 69,
      78, 68, 174, 66, 96, 130,
    ]);
    const dataUrl = createDataUrl(mockImageData, "image/png");

    renderImage({ src: "test.png", alt: "Test image" }, dataUrl);

    // Mock IntersectionObserver
    const mockObserve = vi.fn();
    const mockUnobserve = vi.fn();
    const mockDisconnect = vi.fn();

    global.IntersectionObserver = vi.fn().mockImplementation((callback) => ({
      observe: mockObserve.mockImplementation((target) => {
        // Simulate element entering viewport
        callback([{ isIntersecting: true, target }], this);
      }),
      unobserve: mockUnobserve,
      disconnect: mockDisconnect,
    }));

    // Wait for image to load
    await waitFor(() => {
      const img = screen.getByRole("img") as HTMLImageElement;
      expect(img).toBeInTheDocument();
      expect(img.src).toBe(dataUrl);
      expect(img.alt).toBe("Test image");
    });

    const mockStore = vi.mocked(RootStore.useReaderStore).mock.results[0]
      ?.value;
    expect(mockStore?.getImage).toHaveBeenCalledWith(
      mockStore.currentChapter,
      "test.png",
    );
  });

  it("displays error when image fails to load", async () => {
    const { container } = renderImage({ src: "missing.jpg" });

    // Mock IntersectionObserver
    global.IntersectionObserver = vi.fn().mockImplementation((callback) => ({
      observe: vi.fn().mockImplementation((target) => {
        callback([{ isIntersecting: true, target }], this);
      }),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }));

    await waitFor(() => {
      const errorDiv = container.querySelector("div");
      expect(errorDiv?.textContent).toContain(
        "Failed to load image: missing.jpg",
      );
    });
  });

  it("respects width and height props", () => {
    const { container } = renderImage({
      src: "test.jpg",
      width: 200,
      height: 150,
    });

    const placeholder = container.querySelector('div[style*="width: 200px"]');
    expect(placeholder).toHaveStyle({ width: "200px", height: "150px" });
  });

  it("does not load image until it enters viewport", async () => {
    const dataUrl = createDataUrl(new Uint8Array([1, 2, 3]), "image/jpeg");

    // Mock IntersectionObserver that doesn't trigger
    global.IntersectionObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }));

    const { container } = renderImage({ src: "test.jpg" }, dataUrl);

    // Wait a bit to ensure no loading happens
    await new Promise((resolve) => setTimeout(resolve, 100));

    const mockStore = vi.mocked(RootStore.useReaderStore).mock.results[0]
      ?.value;
    expect(mockStore?.getImage).not.toHaveBeenCalled();

    const placeholder = container.querySelector("div");
    expect(placeholder?.textContent).toContain("Image");
  });

  it("handles image error after successful load", async () => {
    const dataUrl = createDataUrl(new Uint8Array([1, 2, 3, 4]), "image/jpeg");
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    renderImage({ src: "test.jpg" }, dataUrl);

    // Mock IntersectionObserver
    global.IntersectionObserver = vi.fn().mockImplementation((callback) => ({
      observe: vi.fn().mockImplementation((target) => {
        callback([{ isIntersecting: true, target }], this);
      }),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }));

    // Wait for image to load
    await waitFor(() => {
      expect(screen.getByRole("img")).toBeInTheDocument();
    });

    // Simulate image error
    const img = screen.getByRole("img") as HTMLImageElement;
    img.onerror?.(new Event("error"));

    await waitFor(() => {
      expect(screen.getByText("Failed to display image")).toBeInTheDocument();
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith("img on error:", "test.jpg");
    consoleErrorSpy.mockRestore();
  });

  it("cleans up intersection observer on unmount", () => {
    const mockDisconnect = vi.fn();

    global.IntersectionObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: mockDisconnect,
    }));

    const { unmount } = renderImage({ src: "test.jpg" });
    unmount();

    expect(mockDisconnect).toHaveBeenCalled();
  });

  it("does not load when currentChapter is null", async () => {
    const mockStore = {
      currentChapter: null,
      getImage: vi.fn(),
    };
    vi.spyOn(RootStore, "useReaderStore").mockReturnValue(mockStore as any);

    const { container } = render(<Image src="test.jpg" />);

    // Mock IntersectionObserver
    global.IntersectionObserver = vi.fn().mockImplementation((callback) => ({
      observe: vi.fn().mockImplementation((target) => {
        callback([{ isIntersecting: true, target }], this);
      }),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }));

    // Wait a bit
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(mockStore.getImage).not.toHaveBeenCalled();
    const placeholder = container.querySelector("div");
    expect(placeholder?.textContent).toContain("Image");
  });
});
