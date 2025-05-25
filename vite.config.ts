import path from "path";

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
	// assetsInclude: ["**/*.wasm"],
	// optimizeDeps: { exclude: ["@electric-sql/pglite", "wa-sqlite"] },
	plugins: [
		react(),
		tailwindcss(),
		// only polyfill what you need to keep the bundle small
		nodePolyfills({
			include: ["path"],
			protocolImports: true, // lets “node:path” resolve cleanly
		}),
	],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
			// "wa-sqlite/dist": path.resolve(__dirname, "./node_modules/wa-sqlite/dist"),
		},
	},
});
