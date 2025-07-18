# EpubDumper Notes

## Design Decisions

### File Output Strategy
- **Metadata files**: Dumped to the root directory with `.dump` suffix (e.g., `metadata.dump.json`)
- **Chapter markdown**: Dumped beside the original HTML files with `.dump.md` suffix
- **Derived data**: All goes to root directory (chapters.dump.json, nav.dump.md, etc.)
- **writeFile method**: Handles baseDir joining internally, so callers just pass relative paths

### Key Changes from Original Implementation
1. **No separate dump directory**: Files are written in-place alongside source files
2. **Class-based design**: Follows the pattern from EPubShortener with static factory methods
3. **Support for both zip and directory inputs**: 
   - `fromZip()`: Unzips to temp directory first
   - `fromDirectory()`: Works directly with directory
4. **Cleanup method**: For removing temp directories when working with zip files

### File Naming Convention
- All dumped files use `.dump` suffix before extension
- Examples:
  - `chapter1.html` → `chapter1.dump.md`
  - Root metadata → `metadata.dump.json`
  - Navigation → `nav.dump.xml`, `nav.dump.md`

### Dependencies
- Uses existing imports from the same package (no external dependencies needed)
- Reuses utility functions like `unzip` from `zipUtils.ts`
- Uses EPub, EPubMarkdownConverter, and MarkdownConverter from the core package