import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.epubdown.reader2",
  appName: "reader2",
  webDir: "dist",
  // Uncomment to load from Vite dev server (use your Mac's IP for device testing)
  // server: {
  //   url: "http://192.168.x.x:5180",
  //   cleartext: true,
  // },
};

export default config;
