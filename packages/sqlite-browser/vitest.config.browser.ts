import { defineConfig, mergeConfig } from "vitest/config";
import shared from "../../vitest.config.browser.shared.js";

export default mergeConfig(
  shared,
  defineConfig({
    test: {
      // Override include pattern to match all test files (not just .test.browser.*)
      include: ["**/*.test.{js,ts,jsx,tsx}"],
    },
  }),
);
