import { render, screen, waitFor } from "@testing-library/react";
import { makeObservable, observable, action } from "mobx";
import { describe, it, expect, beforeEach } from "vitest";
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
