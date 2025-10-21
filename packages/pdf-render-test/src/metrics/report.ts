import type { MemorySample } from "../types.js";

export const computePagesPerSec = (total_ms: number, pages: number) =>
  pages > 0 ? (pages / total_ms) * 1000 : 0;

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
