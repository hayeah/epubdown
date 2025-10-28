import type { UAMemoryBreakdown } from "../types.js";

export function normalizeUAMemory(raw: any): UAMemoryBreakdown {
  if (!raw)
    return {
      total_bytes: null,
      js_bytes: null,
      dom_bytes: null,
      wasm_bytes: null,
      canvas_bytes: null,
      other_bytes: null,
    };
  const out: UAMemoryBreakdown = {
    total_bytes: typeof raw.bytes === "number" ? raw.bytes : null,
    js_bytes: null,
    dom_bytes: null,
    wasm_bytes: null,
    canvas_bytes: null,
    other_bytes: null,
  };
  const list = Array.isArray(raw.breakdown) ? raw.breakdown : [];
  for (const b of list) {
    const bytes = typeof b.bytes === "number" ? b.bytes : 0;
    const types = (b.types ?? []).map((s: string) => s.toLowerCase());
    if (
      types.includes("javascript") ||
      types.includes("js") ||
      types.includes("js_heap")
    )
      out.js_bytes = (out.js_bytes ?? 0) + bytes;
    else if (types.includes("dom"))
      out.dom_bytes = (out.dom_bytes ?? 0) + bytes;
    else if (types.includes("wasm") || types.includes("webassembly"))
      out.wasm_bytes = (out.wasm_bytes ?? 0) + bytes;
    else if (
      types.includes("canvas") ||
      types.includes("graphics") ||
      types.includes("raster")
    )
      out.canvas_bytes = (out.canvas_bytes ?? 0) + bytes;
    else out.other_bytes = (out.other_bytes ?? 0) + bytes;
  }
  return out;
}
