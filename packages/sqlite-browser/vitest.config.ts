import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      instances: [
        {
          browser: "chromium",
        },
      ],
      provider: "playwright",
      headless: true,
    },
    include: ["**/*.test.browser.{js,ts,jsx,tsx}", "**/*.test.{js,ts,jsx,tsx}"],
  },
});
