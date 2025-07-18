#!/usr/bin/env bun
import fs from "node:fs/promises";
import path from "node:path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { EpubDumper } from "../utils/EpubDumper";

async function dumpPath(targetPath: string, verbose: boolean) {
  const stats = await fs.stat(targetPath);

  if (stats.isFile() && targetPath.toLowerCase().endsWith(".epub")) {
    // Handle zip file
    console.log(`Dumping EPUB file: ${targetPath}`);
    const zipData = await fs.readFile(targetPath);
    const dumper = await EpubDumper.fromZip(zipData, { verbose });
    await dumper.dump();
    await dumper.cleanup();
  } else if (stats.isDirectory()) {
    // Handle directory
    console.log(`Dumping EPUB directory: ${targetPath}`);
    const dumper = await EpubDumper.fromDirectory(targetPath, { verbose });
    await dumper.dump();
  } else {
    throw new Error(`${targetPath} is neither an EPUB file nor a directory`);
  }
}

interface Args {
  _: string[];
  verbose?: boolean;
  [x: string]: unknown;
}

async function main() {
  const argv = (await yargs(hideBin(process.argv))
    .usage("Usage: $0 <input> [options]")
    .positional("input", {
      describe: "Path to EPUB file or directory to dump",
      type: "string",
    })
    .option("verbose", {
      alias: "v",
      type: "boolean",
      description: "Show verbose output with timing information",
      default: false,
    })
    .demandCommand(1, "Please provide an input path")
    .help()
    .alias("help", "h")
    .parse()) as Args;

  const targetPath = argv._[0];
  if (!targetPath) {
    console.error("Error: No input path provided");
    process.exit(1);
  }

  try {
    await dumpPath(targetPath, argv.verbose || false);
  } catch (error) {
    console.error(`Error dumping ${targetPath}:`, error);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
