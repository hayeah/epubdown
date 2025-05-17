#!/usr/bin/env bun
import path from 'path';
import fs from 'fs/promises';
import { EPubParser } from '../lib/epub/EPubParser';
import TurndownService from 'turndown';

const epubsDir = path.join(import.meta.dir, '../../epubs');

function slug(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50) || 'untitled'
  );
}

async function dumpSingle(epubPath: string) {
  console.log(`dumping ${epubPath}`);
  const parser = await EPubParser.load(epubPath);

  // Create directories first
  const baseDir = path.join(
    path.dirname(epubPath),
    path.basename(epubPath, '.epub') + '_dump'
  );
  const chaptersDir = path.join(baseDir, 'chapters');
  // const markdownDir = path.join(baseDir, 'markdown');
  const rawDir = path.join(baseDir, 'raw');

  await fs.mkdir(chaptersDir, { recursive: true });
  // await fs.mkdir(markdownDir, { recursive: true });
  await fs.mkdir(rawDir, { recursive: true });

  // Dump container XML
  const containerFile = parser['zip'].file('META-INF/container.xml');
  if (containerFile) {
    const containerContent = await containerFile.async('text');
    await fs.writeFile(
      path.join(rawDir, 'container.xml'),
      containerContent,
      'utf8'
    );
  }

  // Get OPF path and content
  const opfPath = await parser['getOpfPath']();
  const opfFile = parser['zip'].file(opfPath);
  if (!opfFile) {
    throw new Error('Invalid epub: missing OPF file');
  }
  const opfContent = await opfFile.async('text');
  // const opfData = parser['xmlParser'].parse(opfContent);

  // Save raw OPF content
  await fs.writeFile(
    path.join(rawDir, 'opf.xml'),
    opfContent,
    'utf8'
  );

  // Check if nav item exists and dump it
  const manifest = await parser.manifest();
  const navItem = manifest.find(item => item.properties?.includes('nav'));

  if (navItem) {
    console.log(`Found nav item: ${navItem.href}`);
    const navPath = await parser['resolveFromOpf'](navItem.href);
    const navFile = parser['zip'].file(navPath);

    if (navFile) {
      const navContent = await navFile.async('text');
      await fs.writeFile(
        path.join(rawDir, 'nav.xml'),
        navContent,
        'utf8'
      );
    }
  } else {
    console.log('No nav item found');
  }

  const { metadata, chapters } = await parser.parse();

  // write metadata
  await fs.writeFile(
    path.join(baseDir, 'metadata.json'),
    JSON.stringify(metadata, null, 2),
    'utf8'
  );

  // Initialize Turndown for markdown conversion
  const td = new TurndownService({ headingStyle: 'atx' });
  // custom rule to turn calibre page-break spans into hr
  td.addRule('pageBreak', {
    filter: (node) => node.nodeName === 'SPAN' && node.classList.contains('page-break'),
    replacement: () => '\n\n---\n\n'
  });

  // write chapters
  for (let i = 0; i < chapters.length; i++) {
    const chapter = chapters[i]!;
    const baseName = `${String(i + 1).padStart(4, '0')}_${slug(
      chapter.title || chapter.id || chapter.href
    )}`;

    // Write HTML version
    const htmlName = `${baseName}.html`;
    await fs.writeFile(path.join(chaptersDir, htmlName), chapter.content, 'utf8');

    // Convert to markdown and write markdown version
    const markdownName = `${baseName}.md`;
    const markdown = td.turndown(chapter.content);
    await fs.writeFile(path.join(chaptersDir, markdownName), markdown, 'utf8');
  }

  console.log(`wrote → ${baseDir}`);
}

async function main() {
  const entries = await fs.readdir(epubsDir);

  for (const entry of entries) {
    if (!entry.toLowerCase().endsWith('.epub')) continue;
    const fullPath = path.join(epubsDir, entry);
    try {
      await dumpSingle(fullPath);
    } catch (error) {
      console.error(`Error dumping ${fullPath}:`, error);
    }
  }
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
