import { render, screen, waitFor } from "@testing-library/react";
import { makeObservable, observable, action } from "mobx";
import { describe, it, expect, beforeEach } from "vitest";
import { useState, useEffect, useRef } from "react";
import { AsyncView } from "./AsyncView";

class TestStore {
  counter = 0;
  message = "initial";

  constructor() {
    makeObservable(this, {
      counter: observable,
      message: observable,
      increment: action,
      setMessage: action,
    });
  }

  increment() {
    this.counter++;
  }

  setMessage(msg: string) {
    this.message = msg;
  }
}

describe("AsyncView MobX tracking", () => {
  let store: TestStore;

  beforeEach(() => {
    store = new TestStore();
  });

  it("should track observables accessed synchronously before first await", async () => {
    let renderCount = 0;

    render(
      <AsyncView>
        {async () => {
          renderCount++;
          // Access observable synchronously (before any await)
          const count = store.counter;
          // Simulate async work
          await Promise.resolve();
          return <div>Count: {count}</div>;
        }}
      </AsyncView>,
    );

    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByText("Count: 0")).toBeInTheDocument();
    });
    expect(renderCount).toBe(1);

    // Change the observable - should trigger re-render if tracked
    store.increment();

    // Wait for re-render
    await waitFor(() => {
      expect(screen.getByText("Count: 1")).toBeInTheDocument();
    });
    expect(renderCount).toBe(2);
  });

  it("should NOT track observables accessed after await", async () => {
    let renderCount = 0;

    render(
      <AsyncView>
        {async () => {
          renderCount++;
          // Simulate async work BEFORE accessing observable
          await Promise.resolve();
          // Access observable AFTER await - should NOT be tracked
          const count = store.counter;
          return <div>Count: {count}</div>;
        }}
      </AsyncView>,
    );

    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByText("Count: 0")).toBeInTheDocument();
    });
    expect(renderCount).toBe(1);

    // Change the observable
    store.increment();

    // Wait a bit to ensure no re-render happens
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Should still show old value since it wasn't tracked
    expect(screen.getByText("Count: 0")).toBeInTheDocument();
    expect(renderCount).toBe(1); // No re-render
  });

  it("should track multiple observables accessed synchronously", async () => {
    let renderCount = 0;

    render(
      <AsyncView>
        {async () => {
          renderCount++;
          // Access multiple observables synchronously
          const count = store.counter;
          const msg = store.message;
          await Promise.resolve();
          return (
            <div>
              {count} - {msg}
            </div>
          );
        }}
      </AsyncView>,
    );

    await waitFor(() => {
      expect(screen.getByText("0 - initial")).toBeInTheDocument();
    });
    expect(renderCount).toBe(1);

    // Change first observable
    store.increment();
    await waitFor(() => {
      expect(screen.getByText("1 - initial")).toBeInTheDocument();
    });
    expect(renderCount).toBe(2);

    // Change second observable
    store.setMessage("updated");
    await waitFor(() => {
      expect(screen.getByText("1 - updated")).toBeInTheDocument();
    });
    expect(renderCount).toBe(3);
  });

  it("should re-track observables on each autorun execution", async () => {
    let renderCount = 0;
    let useCounter = true;

    const Wrapper = () => (
      <AsyncView>
        {async () => {
          renderCount++;
          // Conditionally access different observables
          const value = useCounter ? store.counter : store.message;
          await Promise.resolve();
          return <div>Value: {value}</div>;
        }}
      </AsyncView>
    );

    const { rerender } = render(<Wrapper />);

    await waitFor(() => {
      expect(screen.getByText("Value: 0")).toBeInTheDocument();
    });
    expect(renderCount).toBe(1);

    // Change counter - should trigger re-render
    store.increment();
    await waitFor(() => {
      expect(screen.getByText("Value: 1")).toBeInTheDocument();
    });
    expect(renderCount).toBe(2);

    // Switch to using message
    useCounter = false;
    rerender(<Wrapper />);

    await waitFor(() => {
      expect(screen.getByText("Value: initial")).toBeInTheDocument();
    });

    // Change message - should now trigger re-render
    store.setMessage("new");
    await waitFor(() => {
      expect(screen.getByText("Value: new")).toBeInTheDocument();
    });

    // Change counter - should NOT trigger re-render anymore
    const countBeforeCounterChange = renderCount;
    store.increment();
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(renderCount).toBe(countBeforeCounterChange); // No additional render
  });

  it("should handle errors and show error view", async () => {
    render(
      <AsyncView onError={(err) => <div>Error: {err.message}</div>}>
        {async () => {
          // Access observable before throwing
          const count = store.counter;
          await Promise.resolve();
          throw new Error(`Failed at count ${count}`);
        }}
      </AsyncView>,
    );

    await waitFor(() => {
      expect(screen.getByText("Error: Failed at count 0")).toBeInTheDocument();
    });
  });
});

describe("AsyncView component function returns with hooks", () => {
  let store: TestStore;

  beforeEach(() => {
    store = new TestStore();
  });

  it("should support useState hook in component function", async () => {
    const effectCallCount = 0;

    render(
      <AsyncView>
        {async () => {
          // Access observable before await
          const initialCount = store.counter;
          await Promise.resolve();

          // Return a component function that uses hooks
          return () => {
            const [localCount, setLocalCount] = useState(0);

            return (
              <div>
                <div>Store: {initialCount}</div>
                <div>Local: {localCount}</div>
                <button onClick={() => setLocalCount(localCount + 1)}>
                  Increment Local
                </button>
              </div>
            );
          };
        }}
      </AsyncView>,
    );

    await waitFor(() => {
      expect(screen.getByText("Store: 0")).toBeInTheDocument();
      expect(screen.getByText("Local: 0")).toBeInTheDocument();
    });

    // Click the button to update local state
    const button = screen.getByText("Increment Local");
    button.click();

    await waitFor(() => {
      expect(screen.getByText("Local: 1")).toBeInTheDocument();
    });
  });

  it("should support useRef hook in component function", async () => {
    const divRefs: Array<HTMLDivElement | null> = [];

    render(
      <AsyncView>
        {async () => {
          // Access observable before await
          const count = store.counter;
          await Promise.resolve();

          // Return a component function that uses refs
          return () => {
            const divRef = useRef<HTMLDivElement>(null);

            // Store ref for test verification
            if (divRef.current) {
              divRefs.push(divRef.current);
            }

            return (
              <div ref={divRef} data-testid="ref-div">
                Count: {count}
              </div>
            );
          };
        }}
      </AsyncView>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("ref-div")).toBeInTheDocument();
    });

    // Verify ref is set
    const div = screen.getByTestId("ref-div");
    expect(div).toBeInstanceOf(HTMLDivElement);
  });

  it("should support useEffect hook in component function", async () => {
    const effectLogs: string[] = [];

    render(
      <AsyncView>
        {async () => {
          // Access observable before await
          const count = store.counter;
          await Promise.resolve();

          // Return a component function that uses effects
          return () => {
            useEffect(() => {
              effectLogs.push(`mounted-${count}`);
              return () => {
                effectLogs.push(`unmounted-${count}`);
              };
            }, []);

            return <div data-testid="effect-test">Effect count: {count}</div>;
          };
        }}
      </AsyncView>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("effect-test")).toHaveTextContent(
        "Effect count: 0",
      );
    });

    // Verify effect ran
    await waitFor(() => {
      expect(effectLogs).toContain("mounted-0");
    });
  });

  it("should re-render component function when observable changes", async () => {
    let renderCount = 0;

    render(
      <AsyncView>
        {async () => {
          renderCount++;
          // Access observable before await (tracked)
          const count = store.counter;
          await Promise.resolve();

          // Return a component function
          return () => {
            const [localState] = useState("static");
            return (
              <div>
                Store: {count}, Local: {localState}
              </div>
            );
          };
        }}
      </AsyncView>,
    );

    await waitFor(() => {
      expect(screen.getByText("Store: 0, Local: static")).toBeInTheDocument();
    });
    expect(renderCount).toBe(1);

    // Change observable - should trigger re-render
    store.increment();

    await waitFor(() => {
      expect(screen.getByText("Store: 1, Local: static")).toBeInTheDocument();
    });
    expect(renderCount).toBe(2);
  });

  it("should support mixed hooks in component function", async () => {
    const effectLogs: string[] = [];

    render(
      <AsyncView>
        {async () => {
          // Access observable before await
          const storeValue = store.message;
          await Promise.resolve();

          // Return component with multiple hooks
          return () => {
            const [count, setCount] = useState(0);
            const divRef = useRef<HTMLDivElement>(null);

            useEffect(() => {
              effectLogs.push(`effect-${storeValue}-${count}`);
            }, [count]);

            return (
              <div ref={divRef} data-testid="mixed-hooks-test">
                <div>Message: {storeValue}</div>
                <div>Hook count: {count}</div>
                <button onClick={() => setCount(count + 1)}>Increment</button>
              </div>
            );
          };
        }}
      </AsyncView>,
    );

    await waitFor(() => {
      expect(screen.getByText("Message: initial")).toBeInTheDocument();
      expect(screen.getByText("Hook count: 0")).toBeInTheDocument();
    });

    // Click button to update local state
    screen.getByText("Increment").click();

    await waitFor(() => {
      expect(screen.getByText("Hook count: 1")).toBeInTheDocument();
    });

    // Verify effects ran
    await waitFor(() => {
      expect(effectLogs).toContain("effect-initial-0");
      expect(effectLogs).toContain("effect-initial-1");
    });
  });
});
