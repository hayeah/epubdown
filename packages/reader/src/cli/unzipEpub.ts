#!/usr/bin/env bun
import path from "node:path";
import { extractZip } from "../lib/epub/extractZip";

async function main() {
  const epubPath = process.argv[2];
  if (!epubPath) {
    console.error("Usage: unzipEpub <epub-file>");
    process.exit(1);
  }

  try {
    const absolutePath = path.resolve(epubPath);
    const targetDir = path.join(
      path.dirname(absolutePath),
      path.basename(absolutePath, ".epub"),
    );

    console.log(`Extracting ${absolutePath} to ${targetDir}`);
    await extractZip(absolutePath, targetDir);
    console.log("Done!");
  } catch (error) {
    if (error instanceof Error) {
      console.error("Error:", error.message);
    } else {
      console.error("Unknown error:", error);
    }
    process.exit(1);
  }
}

main();
