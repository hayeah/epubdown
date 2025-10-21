import type { MemorySample } from "../types.js";
import { estimateCanvasBytes } from "../util/canvas.js";
import { normalizeUAMemory } from "./uaMemory.js";

const hasUAMemory = () =>
  (self as any).crossOriginIsolated &&
  typeof (performance as any).measureUserAgentSpecificMemory === "function";

export async function sampleMemory(
  canvases: HTMLCanvasElement[],
): Promise<MemorySample> {
  const ts_ms = performance.now();
  const canvas_estimated_bytes = canvases.reduce(
    (acc, c) => acc + estimateCanvasBytes(c),
    0,
  );
  let ua = null;
  if (hasUAMemory()) {
    try {
      ua = normalizeUAMemory(
        await (performance as any).measureUserAgentSpecificMemory(),
      );
    } catch {
      // Ignore errors
    }
  }
  const mem: any = (performance as any).memory;
  const js_heap_bytes =
    mem && typeof mem.usedJSHeapSize === "number" ? mem.usedJSHeapSize : null;
  return { ts_ms, ua, js_heap_bytes, canvas_estimated_bytes };
}
