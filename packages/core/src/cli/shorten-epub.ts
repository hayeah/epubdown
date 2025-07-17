#!/usr/bin/env bun

import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, resolve } from "node:path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { shorten, shortenDir } from "../utils/EPubShortener";

interface Arguments {
  input?: string;
  output?: string;
  dir?: string;
  preserveLength: boolean;
  format: boolean;
}

const argv = yargs(hideBin(process.argv))
  .usage("Usage: $0 [options] [input]")
  .command(
    "$0 [input]",
    "Shorten EPUB content by anonymizing text in all chapters",
    (yargs) => {
      return yargs.positional("input", {
        describe: "Path to the EPUB file to shorten",
        type: "string",
      });
    }
  )
  .option("output", {
    alias: "o",
    type: "string",
    describe: "Path to save the shortened EPUB (default: <input>-short.epub)",
  })
  .option("dir", {
    alias: "d",
    type: "string",
    describe:
      "Process an extracted EPUB directory in-place instead of a ZIP file",
  })
  .option("preserve-length", {
    alias: "p",
    type: "boolean",
    default: false,
    describe: "Preserve the original length of text nodes",
  })
  .option("format", {
    alias: "f",
    type: "boolean",
    default: true,
    describe: "Format output with prettier",
  })
  .example("$0 book.epub", "Shorten book.epub and save to book-short.epub")
  .example(
    "$0 book.epub -o shortened.epub",
    "Shorten book.epub and save to shortened.epub"
  )
  .example(
    "$0 --dir extracted-book/",
    "Shorten an extracted EPUB directory in-place"
  )
  .help()
  .alias("help", "h")
  .parseSync();

const {
  input,
  output,
  dir,
  "preserve-length": preserveLength,
  format,
} = argv as any;

async function main() {
  try {
    const options = { preserveLength, format };

    if (dir) {
      // Process directory in-place
      const dirPath = resolve(dir);

      if (!existsSync(dirPath) || !statSync(dirPath).isDirectory()) {
        console.error(`Error: Directory not found or not a directory: ${dir}`);
        process.exit(1);
      }

      console.log(`Shortening EPUB directory: ${dirPath}`);
      await shortenDir(dirPath, options);
      console.log("Directory shortened successfully!");
    } else {
      // Process EPUB file
      if (!input) {
        console.error("Error: Either input file or --dir must be specified");
        process.exit(1);
      }

      const inputPath = resolve(input);

      if (!existsSync(inputPath)) {
        console.error(`Error: File not found: ${input}`);
        process.exit(1);
      }

      // Determine output path
      let outputPath: string;
      if (output) {
        outputPath = resolve(output);
      } else {
        const dir = dirname(inputPath);
        const name = basename(inputPath, extname(inputPath));
        outputPath = resolve(dir, `${name}-short.epub`);
      }

      console.log(`Shortening EPUB file: ${inputPath}`);

      // Read and process EPUB
      const epubData = readFileSync(inputPath);
      const shortenedData = await shorten(epubData, options);

      // Write output
      writeFileSync(outputPath, shortenedData);
      console.log(`Shortened EPUB written to: ${outputPath}`);
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error("An unknown error occurred");
    }
    process.exit(1);
  }
}

main();
