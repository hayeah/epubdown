#!/usr/bin/env bun
import fs from "node:fs/promises";
import path from "node:path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { EPubParser } from "../lib/epub/EPubParser";
import { createTurndownService } from "../lib/markdown";

function slug(text: string): string {
	return (
		text
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "")
			.slice(0, 50) || "untitled"
	);
}

async function dumpSingle(epubPath: string, dumpDir: string) {
	// Helper function to write files relative to the baseDir
	console.log(`dumping ${epubPath}`);
	const parser = await EPubParser.load(epubPath);

	// Create directories first
	const epubBaseName = path.basename(epubPath, ".epub");
	const baseDir = path.join(dumpDir, `${epubBaseName}.dump`);
	const chaptersDir = path.join(baseDir, "chapters");

	const outputFile = async (filePath: string, data: string) => {
		await fs.writeFile(path.join(baseDir, filePath), data, "utf8");
	};

	// Helper function to write files to chapters directory
	const outputChapterFile = async (filePath: string, data: string) => {
		await fs.writeFile(path.join(chaptersDir, filePath), data, "utf8");
	};

	await fs.mkdir(chaptersDir, { recursive: true });

	// Dump container XML
	const containerContent = await parser.readContainerXml();
	await outputFile("container.xml", containerContent);

	// Get OPF path and content
	const opfContent = await parser.readOpfXml();
	// const opfData = parser['xmlParser'].parse(opfContent);

	// Save raw OPF content
	await outputFile("opf.xml", opfContent);

	// Check if nav item exists and dump it
	const manifest = await parser.manifest();
	const navItem = manifest.find((item) => item.properties?.includes("nav"));

	if (navItem) {
		console.log(`Found nav item: ${navItem.href}`);
		const navContent = await parser.readFileFromOpf(navItem.href);

		if (navContent) {
			await outputFile("nav.xml", navContent);
		}
	}

	// Check if NCX file exists and dump it
	const ncxItem = manifest.find(
		(item) => item.mediaType === "application/x-dtbncx+xml",
	);
	if (ncxItem) {
		console.log(`Found NCX item: ${ncxItem.href}`);
		const ncxContent = await parser.readFileFromOpf(ncxItem.href);

		if (ncxContent) {
			await outputFile("ncx.xml", ncxContent);
		}
	}

	const { metadata, chapters, toc } = await parser.parse();

	// write metadata
	await outputFile("metadata.json", JSON.stringify(metadata, null, 2));
	await outputFile("toc.json", JSON.stringify(toc, null, 2));

	// Initialize Turndown for markdown conversion
	const td = createTurndownService();

	// write chapters
	for (const [i, chapter] of chapters.entries()) {
		const baseName = `${String(i + 1).padStart(4, "0")}_${slug(
			chapter.title || chapter.id || chapter.href,
		)}`;

		// Write HTML version
		const htmlName = `${baseName}.html`;
		await outputChapterFile(htmlName, chapter.content);

		// Convert to markdown and write markdown version
		const markdownName = `${baseName}.md`;
		const markdown = td.turndown(chapter.content);
		await outputChapterFile(markdownName, markdown);
	}

	console.log(`wrote → ${baseDir}`);
}

interface Args {
	dir: string;
	[x: string]: unknown;
}

async function main() {
	const argv = (await yargs(hideBin(process.argv))
		.option("dir", {
			alias: "d",
			type: "string",
			description: "Directory containing EPUB files",
			default: path.join(import.meta.dir, "../../epubs"),
		})
		.option("output", {
			alias: "o",
			type: "string",
			description: "Custom output directory for all EPUBs",
		})
		.help()
		.alias("help", "h")
		.parse()) as Args & { output?: string };

	const epubsDir = argv.dir;
	console.log(`Looking for EPUBs in: ${epubsDir}`);

	let dumpDir = `${epubsDir}.dump`;
	if (argv.output) {
		dumpDir = argv.output;
	}

	try {
		const entries = await fs.readdir(epubsDir);

		for (const entry of entries) {
			if (!entry.toLowerCase().endsWith(".epub")) continue;
			const fullPath = path.join(epubsDir, entry);
			try {
				await dumpSingle(fullPath, dumpDir);
			} catch (error) {
				console.error(`Error dumping ${fullPath}:`, error);
			}
		}
	} catch (error) {
		console.error(`Error reading directory ${epubsDir}:`, error);
		process.exit(1);
	}
}

main().catch((err) => {
	console.error("Error:", err);
	process.exit(1);
});
