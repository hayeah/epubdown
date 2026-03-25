import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

export default defineConfig({
  build: {
    target: "esnext",
  },
  plugins: [react(), tailwindcss()],
  lint: {
    options: {
      typeCheck: false,
    },
  },
});
