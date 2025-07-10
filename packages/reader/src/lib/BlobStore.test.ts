import { describe, expect, it } from "vitest";
import { BlobStore } from "./BlobStore";

describe("BlobStore", () => {
  it("should export BlobStore class", () => {
    expect(BlobStore).toBeDefined();
  });

  it("should have static create method", () => {
    expect(BlobStore.create).toBeDefined();
    expect(typeof BlobStore.create).toBe("function");
  });
});
