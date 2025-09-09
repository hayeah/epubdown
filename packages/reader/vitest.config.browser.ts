import { defineConfig, mergeConfig } from "vitest/config";
import shared from "../../vitest.config.browser.shared.js";

export default mergeConfig(
  shared,
  defineConfig({
    // reader-specific overrides go here if needed later
  }),
);
