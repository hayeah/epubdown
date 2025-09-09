#!/usr/bin/env bun
import fs from "node:fs/promises";
import path from "node:path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { EpubDumper } from "../utils/EpubDumper";

async function dumpPath(
  targetPath: string,
  verbose: boolean,
  outputPath?: string,
) {
  const stats = await fs.stat(targetPath);

  if (stats.isFile() && targetPath.toLowerCase().endsWith(".epub")) {
    // Handle single EPUB file
    console.log(`Dumping EPUB file: ${targetPath}`);
    const dumper = await EpubDumper.fromZipFile(targetPath, {
      verbose,
      outputDir: outputPath,
    });
    await dumper.dump();
  } else if (stats.isDirectory()) {
    // Check if directory contains EPUB files
    const files = await fs.readdir(targetPath);
    const epubFiles = files.filter((file) =>
      file.toLowerCase().endsWith(".epub"),
    );

    if (epubFiles.length > 0) {
      // Directory contains EPUB files - process each one
      console.log(
        `Found ${epubFiles.length} EPUB files in directory: ${targetPath}`,
      );

      for (const epubFile of epubFiles) {
        console.log(`\nDumping EPUB file: ${epubFile}`);
        const epubPath = path.join(targetPath, epubFile);

        // If an outputPath is provided, place each dump under it using
        // "<filename>.dump" to match default behavior
        const perFileOutputDir = outputPath
          ? path.join(outputPath, `${epubFile}.dump`)
          : undefined;

        const dumper = await EpubDumper.fromZipFile(epubPath, {
          verbose,
          outputDir: perFileOutputDir,
        });
        await dumper.dump();
      }
    } else {
      // No EPUB files, treat as EPUB directory structure
      console.log(`Dumping EPUB directory: ${targetPath}`);
      const dumper = await EpubDumper.fromDirectory(targetPath, {
        verbose,
        outputDir: outputPath,
      });
      await dumper.dump();
    }
  } else {
    throw new Error(`${targetPath} is neither an EPUB file nor a directory`);
  }
}

interface Args {
  _: string[];
  verbose?: boolean;
  outputPath?: string;
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
    .option("outputPath", {
      alias: "o",
      type: "string",
      description:
        "Output directory or file-specific dump path. For a single .epub, uses this as the dump directory. For a directory of .epub files, creates one subdir per file under this path.",
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
    await dumpPath(targetPath, argv.verbose || false, argv.outputPath);
  } catch (error) {
    console.error(`Error dumping ${targetPath}:`, error);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
