// AsyncView.tsx
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { autorun, type IReactionDisposer } from "mobx";

type AsyncViewProps = {
  children: (ctx: { signal: AbortSignal }) => Promise<React.ReactNode>;
  loader?: React.ReactNode;
  delayMs?: number; // when to show loader, default 500
  onError?: (err: Error) => React.ReactNode;
};

function isAbortError(err: unknown): boolean {
  if (!err) return false;
  if (typeof err === "object") {
    const anyErr = err as any;
    return (
      anyErr?.name === "AbortError" ||
      anyErr?.code === "ABORT_ERR" ||
      anyErr?.message === "aborted" ||
      anyErr?.message === "The operation was aborted"
    );
  }
  return false;
}

/**
 * AsyncView
 *
 * MobX behavior:
 * - We wrap the async child in mobx `autorun`. MobX tracks any observables read
 *   synchronously during the call (i.e., before the first `await`). When those
 *   observables change, the autorun re-executes, and we spawn a new async run.
 *
 * UX behavior:
 * - Keep previously resolved view on screen while reloading.
 * - Show `loader` only if the run takes longer than `delayMs`.
 * - Cancel previous run via AbortController; ignore stale/aborted resolutions.
 */
const defaultErrorView = (err: Error): React.ReactNode => (
  <div className="p-4 border border-red-300 bg-red-50 rounded text-red-700">
    <div className="font-semibold">Error</div>
    <div className="text-sm mt-1">{err.message}</div>
  </div>
);

export function AsyncView({
  children,
  loader,
  delayMs = 500,
  onError = defaultErrorView,
}: AsyncViewProps) {
  const [currentView, setCurrentView] = useState<React.ReactNode | null>(null);
  const [errorView, setErrorView] = useState<React.ReactNode | null>(null);
  const [showLoader, setShowLoader] = useState(false);
  const [pending, setPending] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);
  const disposerRef = useRef<IReactionDisposer | null>(null);

  useEffect(() => {
    // Clean up any prior autorun (React StrictMode may remount effects)
    disposerRef.current?.();
    abortRef.current?.abort();

    // Create a new autorun that tracks the sync portion (pre-await) of `children`.
    const dispose = autorun(() => {
      const thisRunId = ++runIdRef.current;

      // Cancel prior in-flight work
      abortRef.current?.abort();

      const ac = new AbortController();
      abortRef.current = ac;

      // Pending flags + deferred loader to avoid flicker
      setPending(true);
      setShowLoader(false);
      setErrorView(null);
      const t = setTimeout(() => {
        if (runIdRef.current === thisRunId) setShowLoader(true);
      }, delayMs);

      // IMPORTANT: Call children() synchronously to allow MobX to track observables.
      // MobX's autorun only tracks observables accessed during its synchronous execution.
      // Any observables accessed in the async child function (before the first await)
      // will be tracked and trigger re-runs when they change.
      const promise = children({ signal: ac.signal });

      // Now handle the promise result asynchronously
      promise
        .then((node) => {
          // Ignore stale or aborted completions
          if (runIdRef.current !== thisRunId || ac.signal.aborted) return;
          setCurrentView(node);
          setErrorView(null);
        })
        .catch((err) => {
          if (!isAbortError(err)) {
            // Ignore stale or aborted errors
            if (runIdRef.current !== thisRunId || ac.signal.aborted) return;
            const error = err instanceof Error ? err : new Error(String(err));
            setErrorView(onError(error));
            // eslint-disable-next-line no-console
            console.error("AsyncView error:", error);
          }
        })
        .finally(() => {
          clearTimeout(t);
          if (runIdRef.current === thisRunId) {
            setPending(false);
            setShowLoader(false);
          }
        });
    });

    disposerRef.current = dispose;

    return () => {
      abortRef.current?.abort();
      dispose();
      disposerRef.current = null;
    };
  }, [children, delayMs]);

  // Render policy:
  // - If there's an error, show the error view.
  // - Otherwise, keep last successful `currentView` on screen to prevent flicker.
  // - Show `loader` after the delay while pending (overlay/adjacent; up to you).
  // - If no loader is provided, show nothing (just keep currentView or null).
  if (errorView) {
    return <>{errorView}</>;
  }

  return (
    <>
      {currentView}
      {pending && showLoader && loader}
    </>
  );
}
