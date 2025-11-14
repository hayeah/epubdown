/**
 * Generate placeholder icons for the extension
 * Run with: bun packages/extension/scripts/generate-icons.ts
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");

// Ensure public directory exists
mkdirSync(publicDir, { recursive: true });

function generateSVG(size: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#3b82f6" rx="${size * 0.2}"/>
  <text x="50%" y="50%" text-anchor="middle" dy=".35em" fill="white" font-family="Arial, sans-serif" font-size="${size * 0.5}" font-weight="bold">C</text>
</svg>`;
}

const sizes = [16, 48, 128];

for (const size of sizes) {
  const svg = generateSVG(size);
  const filename = `icon${size}.svg`;
  writeFileSync(join(publicDir, filename), svg);
  console.log(`Generated ${filename}`);
}

console.log("\nPlaceholder icons generated successfully!");
console.log("For production, replace these with proper PNG icons.");
