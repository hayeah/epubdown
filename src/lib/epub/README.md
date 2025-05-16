# EPubParser

A TypeScript library for parsing EPUB files. It provides a simple API to extract metadata, table of contents, and chapter contents from EPUB 2.0 and 3.0 files.

## Features

- Parse EPUB metadata (title, author, language, etc.)
- Extract table of contents (supports both EPUB3 nav and EPUB2 NCX)
- Get chapter contents with proper HTML structure
- Access spine and manifest information
- Support for both EPUB 2.0 and 3.0 formats

## Usage

```typescript
// Load an EPUB file
const parser = await EPubParser.load('path/to/book.epub');

// Get metadata
const metadata = await parser.metadata();
console.log(metadata.title); // Book title
console.log(metadata.author); // Book author

// Get table of contents
const toc = await parser.toc();
console.log(toc); // Array of chapters with titles and hrefs

// Get all chapters
const chapters = await parser.chapters();
console.log(chapters); // Array of chapters with content

// Get everything at once
const epubData = await parser.parse();
console.log(epubData); // All EPUB data including metadata, toc, chapters
```

## Development

### Running Tests

Tests are written using Bun's test runner. To run the tests:

```bash
bun test EPubParser.test.ts
```

### Test Fixtures

The tests use fixture files to compare parser output. These fixtures are stored in `test/fixtures/`.

To generate new fixtures (e.g., after making changes to the parser):

```bash
env GEN_FIXTURE=true bun test EPubParser.test.ts
```

The following fixtures are used:
- `alice-manifest.json`: EPUB manifest data
- `alice-spine.json`: Reading order information
- `alice-toc.json`: Table of contents structure
- `alice-chapters.json`: Chapter content and metadata

### Test Data

The tests use "Alice's Adventures in Wonderland" as a test EPUB file, located in `test/fixtures/alice.epub`.
