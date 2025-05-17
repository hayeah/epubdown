#!/usr/bin/env bun
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';

interface Book {
  id: string;
  url: string;
}

const books: Book[] = [
  { id: 'alice', url: 'https://www.gutenberg.org/cache/epub/11/pg11.epub' },
  { id: 'pride', url: 'https://www.gutenberg.org/cache/epub/1342/pg1342.epub' },
  { id: 'tale', url: 'https://www.gutenberg.org/cache/epub/98/pg98.epub' }
];

const outDir = path.join(import.meta.dir, '../../epubs');

await mkdir(outDir, { recursive: true });

for (const book of books) {
  const target = path.join(outDir, `${book.id}.epub`);
  console.log(`Downloading ${book.url}`);
  const resp = await fetch(book.url);
  if (!resp.ok) {
    console.error(`Failed to download ${book.url}: ${resp.status} ${resp.statusText}`);
    continue;
  }
  const buf = Buffer.from(await resp.arrayBuffer());
  await writeFile(target, buf);
  console.log(`Saved ${target}`);
}
