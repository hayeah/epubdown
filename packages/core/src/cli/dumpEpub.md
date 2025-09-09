Dump EPUB Debug Artifacts

Usage

- Single .epub file
  - `bun packages/core/src/cli/dumpEpub.ts <input.epub> [-v] [-o <outputPath>]`

- Directory input
  - Directory of .epub files: `bun packages/core/src/cli/dumpEpub.ts <dir> [-v] [-o <outputDir>]`
    - With `-o/--outputPath`, each file dumps under `<outputDir>/<filename>.epub.dump/`
  - Already-extracted EPUB directory: `bun packages/core/src/cli/dumpEpub.ts <extracted-epub-dir> [-v] [-o <outputDir>]`

Options

- `-v, --verbose` Show timing information for each step
- `-o, --outputPath` Dump output directory
  - Single file: uses this directory for the dump
  - Directory of files: creates a subdir per EPUB under this path

Output

- Writes dump files next to content by default, or under `--outputPath` when provided
- Examples of emitted files:
  - `container.dump.xml`, `opf.dump.xml`, `metadata.dump.json`, `manifest.dump.json`
  - `spineManifest.dump.json`, `toc.navItems.dump.json`, `toc.flatNavItems.dump.json`
  - `nav.dump.xml`, `nav.dump.md` (when a nav document exists)
  - `ncx.dump.xml`, `ncx.dump.html`, `ncx.dump.md` (when an NCX exists)
  - Per-chapter Markdown dumps at `<chapter-path>.dump.md`

Examples

- Dump a specific file with verbose logs to a chosen folder:
  - `bun packages/core/src/cli/dumpEpub.ts -v -o /tmp/epub-dumps \
     "/path/to/your/book.epub"`

- Dump the sample repo EPUBs to /tmp:
  - `bun packages/core/src/cli/dumpEpub.ts -v -o /tmp/epub-dumps epubs/`
