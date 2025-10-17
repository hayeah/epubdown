import { bench, describe } from "vitest";
import { autorun } from "mobx";

describe("autorun performance overhead", () => {
  bench("baseline: direct async function call", async () => {
    await (async () => {
      return "result";
    })();
  });

  bench("autorun with no observable access", async () => {
    let result: string | undefined;
    const dispose = autorun(() => {
      const promise = (async () => {
        return "result";
      })();
      promise.then((r) => {
        result = r;
      });
    });
    dispose();
  });

  bench("autorun with promise tracking (no observables)", async () => {
    for (let i = 0; i < 100; i++) {
      let result: string | undefined;
      const dispose = autorun(() => {
        const promise = (async () => {
          await Promise.resolve();
          return `result-${i}`;
        })();
        promise.then((r) => {
          result = r;
        });
      });
      dispose();
    }
  });

  bench("baseline: 100 direct async calls", async () => {
    for (let i = 0; i < 100; i++) {
      await (async () => {
        await Promise.resolve();
        return `result-${i}`;
      })();
    }
  });

  bench("autorun setup/teardown overhead", () => {
    for (let i = 0; i < 1000; i++) {
      const dispose = autorun(() => {
        // No observable access, just measure setup/teardown
        const x = i * 2;
        return x;
      });
      dispose();
    }
  });

  bench("baseline: 1000 function calls", () => {
    for (let i = 0; i < 1000; i++) {
      const x = i * 2;
    }
  });
});
