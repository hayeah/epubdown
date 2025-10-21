import { describe, expect, it } from "vitest";
import { normalizeUAMemory } from "../../src/metrics/uaMemory.js";

describe("normalizeUAMemory", () => {
  it("maps categories", () => {
    const raw = {
      bytes: 1000,
      breakdown: [
        { bytes: 200, types: ["JavaScript"] },
        { bytes: 300, types: ["DOM"] },
        { bytes: 400, types: ["WebAssembly"] },
        { bytes: 100, types: ["Canvas"] },
      ],
    };
    const out = normalizeUAMemory(raw as any);
    expect(out.total_bytes).toBe(1000);
    expect(out.js_bytes).toBe(200);
    expect(out.dom_bytes).toBe(300);
    expect(out.wasm_bytes).toBe(400);
    expect(out.canvas_bytes).toBe(100);
  });
});
