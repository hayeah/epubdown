import { useEffect, useState } from "react";

/**
 * Run an async factory when deps change.
 * - Cancels on unmount or deps change (via AbortController).
 * - Guards against stale resolutions.
 * - Optional cleanup function will be called when deps change or on unmount.
 */
export function usePromise<T>(
  factory: (signal: AbortSignal) => Promise<T>,
  deps: unknown[],
  cleanup?: () => void,
) {
  const [value, setValue] = useState<T | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: factory is intentionally omitted to allow inline definitions
  useEffect(() => {
    const ac = new AbortController();
    let fresh = true;
    setLoading(true);
    setError(null);

    Promise.resolve()
      .then(() => factory(ac.signal))
      .then((v) => {
        if (!ac.signal.aborted && fresh) setValue(v);
      })
      .catch((e) => {
        if (!ac.signal.aborted && fresh) {
          setError(e instanceof Error ? e : new Error(String(e)));
        }
      })
      .finally(() => {
        if (!ac.signal.aborted && fresh) setLoading(false);
      });

    return () => {
      fresh = false;
      ac.abort();
      // Call cleanup function if provided
      cleanup?.();
    };
  }, [...deps]);

  return { value, error, loading } as const;
}
