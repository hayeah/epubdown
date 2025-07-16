#!/usr/bin/env bun

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { anonymizeXml } from "../utils/anonymizeXml";

interface Arguments {
  input: string;
  output?: string;
  preserveLength: boolean;
  mode: "xml" | "html";
  format: boolean;
}

const argv = yargs(hideBin(process.argv))
  .usage("Usage: $0 [options] <input> [output]")
  .command(
    "$0 <input> [output]",
    "Anonymize XML/HTML files by replacing text content with public domain text",
    (yargs) => {
      return yargs
        .positional("input", {
          describe: "Path to the XML/HTML file to anonymize",
          type: "string",
          demandOption: true,
        })
        .positional("output", {
          describe:
            "Path to save the anonymized output (optional). If not provided, outputs to stdout",
          type: "string",
        });
    },
  )
  .option("preserve-length", {
    alias: "p",
    type: "boolean",
    default: false,
    describe: "Preserve the original length of text nodes",
  })
  .option("mode", {
    alias: "m",
    type: "string",
    choices: ["xml", "html"] as const,
    default: "xml",
    describe: "Parsing mode: both xml and html skip whitespace-only nodes",
  })
  .option("format", {
    alias: "f",
    type: "boolean",
    default: true,
    describe: "Format output with prettier",
  })
  .example(
    "$0 input.xml output.xml",
    "Anonymize input.xml and save to output.xml",
  )
  .example(
    "$0 --preserve-length document.html > anonymized.html",
    "Anonymize with preserved length and redirect to file",
  )
  .example(
    "$0 -p page.xml",
    "Anonymize with preserved length and output to stdout",
  )
  .help()
  .alias("help", "h")
  .parseSync();

// Extract the specific properties we need
const {
  input,
  output,
  "preserve-length": preserveLength,
  mode,
  format,
} = argv as any;

async function main() {
  try {
    // Read input file
    const inputPath = resolve(input);
    const xmlContent = readFileSync(inputPath, "utf-8");

    // Anonymize the XML
    const anonymized = await anonymizeXml(xmlContent, {
      preserveLength,
      mode,
      format,
    });

    // Output the result
    if (output) {
      const outputPath = resolve(output);
      writeFileSync(outputPath, anonymized, "utf-8");
      console.log(`Anonymized XML written to: ${outputPath}`);
    } else {
      // Output to stdout
      console.log(anonymized);
    }
  } catch (error) {
    if (error instanceof Error) {
      if ((error as any).code === "ENOENT") {
        console.error(`Error: File not found: ${input}`);
      } else {
        console.error(`Error: ${error.message}`);
      }
    } else {
      console.error("An unknown error occurred");
    }
    process.exit(1);
  }
}

main();
