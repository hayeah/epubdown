#!/usr/bin/env bun
import { mkdir, writeFile, readFile, access, constants } from 'fs/promises';
import path from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

interface PublicEpub {
  title: string;
  author: string;
  source: string;
  link: string;
}

interface CliArgs {
  redownload?: string;
  verbose: boolean;
}

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
  .option('redownload', {
    type: 'string',
    describe: 'Regex pattern to match titles for redownloading even if they exist',
  })
  .option('verbose', {
    alias: 'v',
    type: 'boolean',
    default: false,
    describe: 'Show more detailed output',
  })
  .help()
  .alias('help', 'h')
  .parseSync() as CliArgs;

// Generate a safe filename from the title
function generateId(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function loadPublicEpubs(): Promise<PublicEpub[]> {
  const filePath = path.join(import.meta.dir, 'publicEpub.toml');
  const content = await readFile(filePath, 'utf-8');
  return (Bun.TOML.parse(content) as { books: PublicEpub[] }).books;
}

// Check if a file exists
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

const outDir = path.join(import.meta.dir, '../../epubs');

// Main execution
async function main() {
  try {
    await mkdir(outDir, { recursive: true });

    const publicEpubs = await loadPublicEpubs();
    console.log(`Found ${publicEpubs.length} epubs to download`);

    // Compile redownload regex if provided
    const redownloadRegex = argv.redownload ? new RegExp(argv.redownload, 'i') : null;

    let skipped = 0;
    let downloaded = 0;
    let failed = 0;

    for (const epub of publicEpubs) {
      const id = generateId(epub.title);
      const target = path.join(outDir, `${id}.epub`);

      // Check if file already exists and should be skipped
      const exists = await fileExists(target);
      const shouldRedownload = redownloadRegex?.test(epub.title) ?? false;

      if (exists && !shouldRedownload) {
        if (argv.verbose) {
          console.log(`Skipping: ${epub.title} (already downloaded)`);
        } else {
          process.stdout.write('.');
        }
        skipped++;
        continue;
      }

      if (exists) {
        console.log(`Redownloading: ${epub.title} (matched redownload pattern)`);
      } else {
        console.log(`Downloading: ${epub.title} by ${epub.author} from ${epub.source}`);
      }

      if (argv.verbose) {
        console.log(`URL: ${epub.link}`);
      }

      try {
        const resp = await fetch(epub.link);
        if (!resp.ok) {
          console.error(`Failed to download ${epub.title}: ${resp.status} ${resp.statusText}`);
          failed++;
          continue;
        }

        const buf = Buffer.from(await resp.arrayBuffer());
        await writeFile(target, buf);
        console.log(`✓ Saved ${target}`);
        downloaded++;
      } catch (error) {
        console.error(`Error downloading ${epub.title}:`, error);
        failed++;
      }
    }

    console.log('\nDownload complete!');
    console.log(`Summary: ${downloaded} downloaded, ${skipped} skipped, ${failed} failed`);
  } catch (error) {
    console.error('Error in main execution:', error);
    process.exit(1);
  }
}

await main();
