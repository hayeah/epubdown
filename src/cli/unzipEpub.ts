#!/usr/bin/env bun
import { extractZip } from '../lib/epub/extractZip';
import path from 'path';

async function main() {
  const epubPath = process.argv[2];
  if (!epubPath) {
    console.error('Usage: unzipEpub <epub-file>');
    process.exit(1);
  }

  try {
    const absolutePath = path.resolve(epubPath);
    const targetDir = path.join(
      path.dirname(absolutePath),
      path.basename(absolutePath, '.epub')
    );

    console.log(`Extracting ${absolutePath} to ${targetDir}`);
    await extractZip(absolutePath, targetDir);
    console.log('Done!');
  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
