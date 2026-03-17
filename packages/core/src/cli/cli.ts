#!/usr/bin/env bun
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { EpubExporter } from "../utils/EpubExporter";

yargs(hideBin(process.argv))
  .scriptName("epub")
  .usage("$0 <command> [options]")
  .command(
    "export <epubFile>",
    "Export an EPUB to markdown with images",
    (yargs) =>
      yargs
        .positional("epubFile", {
          describe: "Path to EPUB file",
          type: "string",
          demandOption: true,
        })
        .option("outdir", {
          alias: "o",
          type: "string",
          description: "Output directory (default: <epubFile>.export/)",
        }),
    async (argv) => {
      try {
        const exporter = await EpubExporter.fromZipFile(
          argv.epubFile,
          argv.outdir,
        );
        await exporter.export();
      } catch (error) {
        console.error("Error:", error);
        process.exit(1);
      }
    },
  )
  .demandCommand(1, "Please specify a command")
  .help()
  .alias("help", "h")
  .strict()
  .parse();
