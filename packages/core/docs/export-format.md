---
title: EPUB Export Directory Format
description: Spec for the flat, markdown-friendly directory structure produced by `epub export`. Covers file naming, image extraction, title resolution, and edge case handling.
---

# EPUB Export Directory Format

The `epub export` CLI converts an EPUB file into a flat, markdown-friendly directory structure suitable for reading, searching, and feeding into LLMs.

## Usage

```
epub export <epubFile> [--outdir <dir>]
```

Default output directory: `<epubFile>.export/`

## Directory Structure

```
<outdir>/
  000-outline.md
  001-<slug>.md
  001/
    image1.png
    image2.jpg
  002-<slug>.md
  003.md
  003/
    diagram.svg
  ...
```

## Files

### `000-outline.md`

Index file with links to all chapter files.

```markdown
# Outline

- [Chapter Title](001-chapter-title.md)
- [Another Chapter](002-another-chapter.md)
- [003.md](003.md)
```

Labels come from the EPUB table of contents. If a chapter has no ToC entry or heading, the link text is the filename itself.

### Chapter Files: `NNN-<slug>.md`

Each spine item (HTML/XHTML chapter) in reading order becomes one markdown file.

- **Numbering**: 3-digit zero-padded index starting at `001`, ensuring alphanumeric sort order matches reading order
- **Slug**: derived from the chapter title (ToC label, or first `#` heading), lowercased, with non-letter/non-number characters replaced by hyphens, truncated to 50 characters
  - Unicode letters and numbers are preserved (CJK, accented characters, etc.)
  - If no title is available, the file is named `NNN.md` with no slug
- **Content**: markdown converted from the chapter HTML via Turndown, with:
  - Headings in ATX style (`#`, `##`, etc.)
  - Fenced code blocks
  - Images referenced with relative paths to the chapter's asset directory

### Asset Directories: `NNN/`

Each chapter that contains images gets a corresponding directory using the same 3-digit prefix. Images are extracted from the EPUB archive and saved with their original filenames. Duplicate basenames within a chapter are disambiguated with a numeric suffix (e.g. `image-2.png`).

Image references in the markdown use relative paths:

```markdown
![alt text](001/figure1.png)
```

Asset directories are only created when a chapter contains images.

## Title Resolution

Chapter titles are resolved in this order:

- ToC label from the EPUB navigation document (EPUB3 nav or EPUB2 NCX)
- First `#` heading found in the converted markdown
- If neither exists, the chapter gets an index-only filename

When multiple ToC entries point to the same file (with different fragment anchors), the first entry's label is used.

## Edge Cases

- **Malformed XHTML**: chapters that fail strict XHTML parsing are automatically retried with lenient HTML parsing
- **Bare text with `<br>` tags**: text nodes and `<br>` elements directly under `<body>` (common in poorly structured EPUBs) are wrapped into `<p>` elements, with each `<br>` treated as a paragraph boundary
- **Images dropped by Turndown**: images are extracted directly from the chapter DOM; if Turndown omits an image from the markdown output, it is appended at the end of the file
- **SVG images**: `<image>` elements inside `<svg>` are detected and extracted alongside regular `<img>` tags
