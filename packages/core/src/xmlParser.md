# xmlParser.ts - Parser Implementation Notes

## Summary

The xmlParser module uses jsdom for both HTML and XML parsing in Node.js environments, and native browser DOMParser in client-side environments. The implementation uses Vite's `import.meta.SSR` for conditional bundling to ensure proper tree-shaking.

## Implementation Details

### Server-side (Node.js)
- Uses jsdom for both HTML and XML parsing
- Provides consistent W3C-compliant DOM implementation
- XML parsing properly handles errors by creating parsererror elements
- HTML parsing follows standard HTML5 parsing rules

### Client-side (Browser)
- Uses native browser DOMParser
- Leverages built-in browser parsing capabilities
- No additional dependencies in browser bundles

### Conditional Loading
- Uses `import.meta.SSR` (Vite) with fallback to `typeof window === "undefined"`
- Ensures jsdom is only loaded in server environments
- Optimizes bundle size for client-side applications

## Key Features

jsdom provides excellent standards compliance for both HTML and XML parsing:

### 1. **Error Handling**
- XML parsing errors are properly captured and wrapped in `<parsererror>` elements
- Invalid XML (e.g., unclosed tags, multiple root elements) generates appropriate error messages
- HTML parsing is forgiving and follows HTML5 error recovery rules

### 2. **Namespace Support**
- Full support for XML namespaces
- `getElementsByTagNameNS` works correctly
- Proper handling of namespace prefixes and default namespaces

### 3. **Standards Compliance**
- HTML mode: Full HTML5 parsing algorithm
- XML mode: Strict XML 1.0 parsing
- Proper handling of void elements, CDATA sections, and entities

### 4. **Performance Considerations**
- jsdom is heavier than linkedom but provides better standards compliance
- Server-side only - not included in client bundles thanks to conditional imports
- Suitable for EPUB processing where correctness is more important than raw performance

## Usage Examples

```typescript
import { parseHtml, parseXml } from './xmlParser';

// HTML parsing (forgiving)
const htmlDoc = parseHtml('<div><p>Hello</div>'); // Missing </p> is handled

// XML parsing (strict)
const xmlDoc = parseXml('<?xml version="1.0"?><root><item/></root>');

// Invalid XML creates parsererror
const invalidXml = parseXml('<root><unclosed>');
// xmlDoc.querySelector('parsererror') will contain the error
```

## Migration from LinkedDOM

The switch from linkedom to jsdom for HTML parsing ensures:
1. Consistent parsing behavior between HTML and XML modes
2. Better standards compliance
3. Proper error handling for both modes
4. Single dependency for all server-side DOM operations