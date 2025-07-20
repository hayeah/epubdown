# EPUBDown Core Usage Guide

This guide shows how to work with the main building‑blocks exposed by **`@epubdown/core`**.
Each section includes hands‑on snippets that you can paste into a TypeScript playground or a Node / Bun / Browser script.

## Resolvers

### What a resolver is

- A **resolver** abstracts _where_ bytes come from (zip file, directory, network, …).
  Every class derives from the `DataResolver` base, which defines
  `read`, `readRaw`, `readXMLFile`, and `rebase`.

### Importing each resolver

```ts
// Tree‑shaken, direct imports
import { ZipDataResolver } from "@epubdown/core/src/resolvers/ZipDataResolver";
import { FileDataResolver } from "@epubdown/core/src/resolvers/FileDataResolver";
import { DataResolver } from "@epubdown/core/src/resolvers/DataResolver";
```

### ZipDataResolver example (browser and Node)

```ts
// Assuming bookBytes is an ArrayBuffer that you obtained via fetch or fs.readFile
const epub = await EPub.fromZip(bookBytes);

// Internally EPub.fromZip constructs a ZipDataResolver like this:
const zip = await JSZip.loadAsync(bookBytes);
const resolver = new ZipDataResolver(zip);
```

- `ZipDataResolver` works everywhere because it depends only on `jszip`.

### FileDataResolver considerations

- **Do not bundle `FileDataResolver` into browser builds.**
  It uses Node’s `fs/promises` APIs, which will trigger polyfill bloat or runtime errors in a browser.

```ts
// Node‑only usage
import { FileDataResolver } from "@epubdown/core/src/resolvers/FileDataResolver";

const resolver = new FileDataResolver("/absolute/path/to/unzipped/epub");
const epub = await EPub.init(resolver);
```

- In a client app prefer `ZipDataResolver` fed by an uploaded `.epub` blob.

### Rolling your own resolver

```ts
class RemoteResolver extends DataResolver {
  async read(href: string) {
    const resp = await fetch(`/assets/${href}`);
    return resp.ok ? await resp.text() : undefined;
  }
  async readRaw(href: string) {
    const resp = await fetch(`/assets/${href}`);
    return resp.ok ? new Uint8Array(await resp.arrayBuffer()) : undefined;
  }
  createInstance(base: string) {
    return new RemoteResolver(base);
  }
}
```

Plug it straight into `EPub.init(new RemoteResolver('/'))`.

## Table of contents

### Nested navigation

```ts
const navItems = await epub.toc.navItems();
// navItems is a tree:
// [
//   { href: 'chapter-1.xhtml', label: 'Chapter 1', subitems: [...] },
//   { href: 'chapter-2.xhtml', label: 'Chapter 2' }
// ]
```

### Flat navigation

```ts
const flat = await epub.toc.flatNavItems();
// [
//   { href: 'chapter-1.xhtml', label: 'Chapter 1', level: 0 },
//   { href: 'chapter-1.xhtml#s1', label: 'Section 1', level: 1, parentHref: 'chapter-1.xhtml' }
// ]
```

- `level` starts at `0` for top nodes.
- `parentHref` links back to the direct ancestor item.

Use the flat form for outline side‑bars or search, and the nested form for rendering hierarchical lists.

## Markdown conversion

### What happens under the hood

- `ContentToMarkdown` wraps **Turndown** with custom rules.
- Steps performed:
  - Strip `<head>`, `<meta>`, `<style>`, `<script>` for clean output.
  - Optionally preserve anchor ids that appear in the TOC so intra‑document links keep working.

### Converting a full chapter

```ts
const md = await epub.chapterMarkdown("Text/chapter-1.xhtml");
console.log(md);
```

Behind the scenes:

```ts
const tocIds = await epub.toc.anchorLinks(); // Map<filePath, Set<ids>>
const keep = tocIds.get(resolvedChapterPath) ?? new Set();
const td = ContentToMarkdown.create({ keepIds: keep });
const md = await td.convertXMLFile(chapterFile);
```

### Stand‑alone conversion with manual id selection

```ts
const html = '<h2 id="quote">Famous Quote</h2><p>Call me Ishmael…</p>';
const converter = ContentToMarkdown.create({ keepIds: new Set(["quote"]) });
const md = await converter.convert(html);
// Outputs:
// <span id="quote"></span>## Famous Quote
//
// Call me Ishmael…
```

## Metadata

```ts
const title = epub.metadata.get("title"); // first title
const titles = epub.metadata.getValues("title"); // every title tag
```

### `toJSON`

- Returns a plain record where each key keeps **only the first** value.

```ts
const concise = epub.metadata.toJSON();
/*
{
  "title": "Moby‑Dick",
  "language": "en",
  "creator": "Herman Melville",
  ...
}
*/
```

Use this when you need a quick summary.

### `toJSONFull`

- Preserves **all** values, element attributes, and every `<meta property="...">` refinement.

```ts
const full = epub.metadata.toJSONFull();
/*
{
  "title": [
    {
      "value": "Moby‑Dick",
      "attributes": { "id": "title1" },
      "refinements": {
        "alternate-script": ["Моби Дик"]
      }
    }
  ],
  "creator": [
    {
      "value": "Herman Melville",
      "attributes": { "id": "creator1", "opf:role": "aut" },
      "refinements": {}
    }
  ]
}
*/
```

Reach for this when you need every last detail, such as building a metadata editor or exporting to another format.

## Putting it all together

```ts
import { EPub } from "@epubdown/core";

// 1. Load an EPUB (browser example)
const bytes = await fetch("/books/alice.epub").then((r) => r.arrayBuffer());
const epub = await EPub.fromZip(bytes);

// 2. Show the title
console.log("Title:", epub.metadata.get("title"));

// 3. Build a side bar with the flat TOC
const items = await epub.toc.flatNavItems();

// 4. Render the selected chapter as Markdown
const currentMd = await epub.chapterMarkdown(items[0].href);
```
