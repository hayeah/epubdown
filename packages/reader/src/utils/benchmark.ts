export async function benchmark<T>(
  name: string,
  promiseOrFn: Promise<T> | (() => Promise<T>),
): Promise<T> {
  const startTime = performance.now();
  const result = await (typeof promiseOrFn === "function"
    ? promiseOrFn()
    : promiseOrFn);
  const endTime = performance.now();
  const duration = endTime - startTime;

  console.log(`[Benchmark] ${name}: ${duration.toFixed(2)}ms`);

  return result;
}
