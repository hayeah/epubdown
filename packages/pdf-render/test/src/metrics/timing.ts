export async function time<T>(
  fn: () => Promise<T>,
): Promise<{ ms: number; value: T }> {
  const t0 = performance.now();
  const value = await fn();
  return { ms: performance.now() - t0, value };
}

export const pagesPerSecond = (totalMs: number, pages: number) =>
  pages > 0 ? (pages / totalMs) * 1000 : 0;
