# TableOfContents Implementation Notes

## NCX to HTML Conversion

When converting NCX (EPUB2) to HTML navigation format, the generated HTML includes namespaced attributes like `epub:type="toc"`. 

### XML Namespace Issue (Fixed)

The `ncxToHTML()` method generates HTML with the `epub:type` attribute, but when parsing this HTML as XML, the namespace needs to be properly declared.

**Solution**: Added the namespace declaration to the generated HTML:
```xml
<nav xmlns:epub="http://www.idpf.org/2007/ops" epub:type="toc">
```

This ensures that when the XML is parsed, the namespace is preserved and the `querySelectorNamespaced` function can correctly find the nav element with the `epub:type="toc"` attribute.

## Star Maker EPUB Structure

The Star Maker EPUB has an unusual but valid NCX structure where all chapters are nested under a single root "STAR MAKER" navPoint. This creates a deeply nested TOC structure:

```
STAR MAKER
├── Enter the SF Gateway
├── Contents
├── Foreword
├── CHAPTER 1 - THE EARTH
│   ├── 1. THE STARTING POINT
│   └── 2. EARTH AMONG THE STARS
├── CHAPTER 2 - INTERSTELLAR TRAVEL
└── ... (all other chapters)
```

This structure is correctly handled by the implementation.

## FlatNavItem vs NavItem

- `NavItem`: Hierarchical representation with nested `subitems` arrays
- `FlatNavItem`: Flattened representation without `subitems`, includes `level` and `parentHref` to maintain hierarchy information

The `FlatNavItem` interface was designed to be more compact for serialization and processing, avoiding the redundancy of nested structures in the flattened output.