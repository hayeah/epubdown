# AsyncView

A React component that wraps async operations with MobX reactivity, loading states, and error handling.

## Features

- **MobX Integration**: Automatically tracks observables accessed before the first `await` in the async function
- **Loading States**: Configurable delayed loader to prevent flicker
- **Error Handling**: Built-in error boundary with customizable error views
- **Abort Support**: Cancels stale operations via `AbortSignal`
- **Previous View Retention**: Keeps the last successful render on screen during reloads

## Usage

### Basic Usage (React Nodes)

```tsx
import { AsyncView } from './lib/AsyncView';

function MyComponent() {
  const store = useMyStore();

  return (
    <AsyncView
      loader={<Spinner />}
      delayMs={500}
      onError={(err) => <ErrorMessage error={err} />}
    >
      {async ({ signal }) => {
        // Access observables here (before first await) for MobX tracking
        const data = store.someObservable;

        // Perform async work
        const result = await fetchData(data, { signal });

        // Return React nodes
        return <div>{result}</div>;
      }}
    </AsyncView>
  );
}
```

### Advanced Usage (Component Function with Hooks)

To use React hooks like `useState`, `useEffect`, or `useRef` in your async content, return a component function instead of React nodes:

```tsx
import { AsyncView } from './lib/AsyncView';

function MyComponent() {
  const store = useMyStore();

  return (
    <AsyncView
      loader={<Spinner />}
      delayMs={500}
      onError={(err) => <ErrorMessage error={err} />}
    >
      {async ({ signal }) => {
        // Access observables here (before first await) for MobX tracking
        const data = store.someObservable;

        // Perform async work
        const result = await fetchData(data, { signal });

        // Return a component function to use hooks
        return () => {
          // Now you can use hooks!
          const [count, setCount] = useState(0);
          const divRef = useRef<HTMLDivElement>(null);

          useEffect(() => {
            console.log('Component mounted');
          }, []);

          return (
            <div ref={divRef}>
              {result}
              <button onClick={() => setCount(count + 1)}>
                Count: {count}
              </button>
            </div>
          );
        };
      }}
    </AsyncView>
  );
}
```

**Note:** When returning a component function, you can ignore dependencies in hooks since AsyncView relies on MobX observables to trigger re-renders, not React's dependency arrays.

### Equivalent useEffect + useState Implementation

Without `AsyncView`, you'd need to manually manage state, cleanup, and MobX reactions:

```tsx
import { useEffect, useState } from 'react';
import { autorun } from 'mobx';

function MyComponent() {
  const store = useMyStore();
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);
  const [showLoader, setShowLoader] = useState(false);

  useEffect(() => {
    let mounted = true;
    const ac = new AbortController();

    // Manual MobX tracking
    const dispose = autorun(() => {
      const data = store.someObservable;  // Track observable

      setLoading(true);
      setShowLoader(false);
      setError(null);

      // Delayed loader
      const timer = setTimeout(() => {
        if (mounted) setShowLoader(true);
      }, 500);

      fetchData(data, { signal: ac.signal })
        .then((value) => {
          if (!ac.signal.aborted && mounted) {
            setResult(value);
            setError(null);
          }
        })
        .catch((err) => {
          if (!ac.signal.aborted && mounted) {
            setError(err);
          }
        })
        .finally(() => {
          clearTimeout(timer);
          if (mounted) {
            setLoading(false);
            setShowLoader(false);
          }
        });
    });

    return () => {
      mounted = false;
      ac.abort();
      dispose();
    };
  }, [store]);  // Must track store changes manually

  if (error) return <ErrorMessage error={error} />;

  return (
    <>
      {result && <div>{result}</div>}
      {loading && showLoader && <Spinner />}
    </>
  );
}
```

**AsyncView eliminates this boilerplate** by handling all the state management, cleanup, and MobX tracking automatically.

## Props

- `children: (ctx: { signal: AbortSignal }) => Promise<React.ReactNode>` - Async function that returns React content
- `loader?: React.ReactNode` - Optional loading indicator (shown after `delayMs`)
- `delayMs?: number` - Delay before showing loader (default: 500ms)
- `onError?: (err: Error) => React.ReactNode` - Custom error view renderer

## MobX Tracking Behavior

The component uses MobX's `autorun` to automatically re-run when tracked observables change. **Only observables accessed synchronously** (before the first `await`) are tracked.

### Example: Tracked Observable

```tsx
<AsyncView>
  {async () => {
    const count = store.counter;  // ✅ Tracked - accessed before await
    await fetchData();
    return <div>{count}</div>;
  }}
</AsyncView>
```

When `store.counter` changes, the entire async function re-runs.

### Example: NOT Tracked

```tsx
<AsyncView>
  {async () => {
    await fetchData();
    const count = store.counter;  // ❌ NOT tracked - accessed after await
    return <div>{count}</div>;
  }}
</AsyncView>
```

The observable is accessed after the first `await`, so changes won't trigger re-runs.

## Performance

Benchmark results show minimal overhead:

```
name                                          hz        mean       p99
────────────────────────────────────────────────────────────────────
baseline: direct async function call    8,463,790   0.0001ms   0.0002ms
autorun with no observable access       2,110,123   0.0005ms   0.0007ms
autorun setup/teardown overhead             2,648   0.3776ms   0.9305ms
```

**Key takeaways:**
- Single `autorun` call overhead: **~0.0004ms** (4x slower than direct call)
- Setup/teardown per component mount: **~0.4ms**
- Overhead is negligible for typical UI rendering scenarios
- Benefits of automatic reactivity far outweigh the tiny cost

Even when no MobX observables are accessed, the performance impact is imperceptible in real-world applications.

## Implementation Details

### Why Synchronous `children()` Call?

The component calls `children()` synchronously within `autorun`:

```typescript
const dispose = autorun(() => {
  const promise = children({ signal: ac.signal });  // ✅ Synchronous call
  promise.then(...);
});
```

This is critical for MobX tracking. If we used `Promise.resolve().then(() => children())`, the call would be deferred to a microtask, executing **after** `autorun`'s synchronous tracking phase completes. No observables would be tracked.

### Abort Signal

Each run gets a fresh `AbortController`. When observables change and trigger a re-run:
1. Previous `AbortController` is aborted
2. New `AbortController` is created
3. New async operation starts

This prevents stale results from completing and overwriting newer data.

### Error Handling

Errors are caught and passed to the `onError` callback. The default error view shows:

```tsx
<div className="p-4 border border-red-300 bg-red-50 rounded text-red-700">
  <div className="font-semibold">Error</div>
  <div className="text-sm mt-1">{err.message}</div>
</div>
```

Abort errors (`AbortError`) are silently ignored.

## Testing

See `AsyncView.test.browser.tsx` for comprehensive tests covering:
- MobX tracking behavior with observables before/after `await`
- Multiple observable tracking
- Dynamic re-tracking when dependencies change
- Error handling
- Loading states

Run tests:
```bash
pnpm -C packages/reader test:browser AsyncView.test.browser
```

## Benchmarks

Run performance benchmarks:
```bash
pnpm -C packages/reader exec vitest bench AsyncView.bench
```
