#!/usr/bin/env node

import { readFileSync } from "node:fs";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { MarkdownTurndownService } from "../MarkdownConverter";

const argv = yargs(hideBin(process.argv))
  .usage("Usage: $0 [options]")
  .option("input", {
    alias: "i",
    type: "string",
    description: "Input HTML/XML file path",
  })
  .option("output", {
    alias: "o",
    type: "string",
    description: "Output markdown file path",
  })
  .help()
  .alias("help", "h")
  .parseSync();

async function main() {
  try {
    let htmlContent: string;

    if (argv.input) {
      // Read from file
      htmlContent = readFileSync(argv.input, "utf-8");
    } else {
      // Read from stdin
      htmlContent = readFileSync(0, "utf-8");
    }

    // Convert HTML/XML to markdown
    const converter = new MarkdownTurndownService();
    const markdown = converter.turndown(htmlContent);

    // Output the result
    if (argv.output) {
      const { writeFileSync } = await import("node:fs");
      writeFileSync(argv.output, markdown, "utf-8");
    } else {
      process.stdout.write(markdown);
    }
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main();
