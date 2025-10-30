import type { MemorySample } from "../types.js";
import { pagesPerSecond } from "./timing.js";

/**
 * Compute pages per second rate
 * @deprecated Use pagesPerSecond from timing.js instead
 */
export const computePagesPerSec = (total_ms: number, pages: number) =>
  pagesPerSecond(total_ms, pages);

export const computeUADelta = (
  before: MemorySample | null,
  after: MemorySample | null,
): number | null =>
  before?.ua?.total_bytes != null && after?.ua?.total_bytes != null
    ? after.ua.total_bytes - before.ua.total_bytes
    : null;

export const computeCanvasDelta = (
  before: MemorySample | null,
  after: MemorySample | null,
): number =>
  (after?.canvas_estimated_bytes ?? 0) - (before?.canvas_estimated_bytes ?? 0);
