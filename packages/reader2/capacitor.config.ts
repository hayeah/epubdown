import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.epubdown.reader2",
  appName: "reader2",
  webDir: "dist",
  server: {
    // During dev, load from Vite dev server instead of built assets
    // Comment this out for production builds
    url: "http://localhost:5180",
    cleartext: true,
  },
};

export default config;
