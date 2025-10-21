import { describe, expect, it } from "vitest";
import { estimateCanvasBytes } from "../../src/util/canvas.js";

describe("estimateCanvasBytes", () => {
  it("computes RGBA bytes", () => {
    const c = Object.assign(document.createElement("canvas"), {
      width: 100,
      height: 50,
    });
    expect(estimateCanvasBytes(c)).toBe(100 * 50 * 4);
  });
});
