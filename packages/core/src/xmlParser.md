# xmlParser.ts - LinkedDOM Behavior Notes

## Summary

LinkedDOM is a server-side DOM implementation that doesn't fully comply with W3C standards for XML parsing. While it handles some differences between HTML and XML modes correctly, it has significant deviations, particularly with XML features.

## Standards Compliance Overview

| Feature | HTML Mode | XML Mode |
|---------|-----------|----------|
| Case Sensitivity | ✅ Standard | ⚠️ Partial |
| Self-closing Tags | ✅ Standard | ✅ Standard |
| Void Elements | ✅ Standard | ❌ Deviation |
| Namespaces | ✅ Standard | ❌ Deviation |
| CDATA Sections | ⚠️ Partial | ✅ Standard |
| Entity References | ✅ Standard | ✅ Standard |
| Error Handling | ✅ Standard | ❌ Deviation |
| Attribute Quotes | ✅ Standard | ❌ Deviation |

## Key Findings

LinkedDOM does NOT fully respect the difference between HTML and XML parsing modes. Here's what we discovered:

### 1. **Namespace Handling**
- In XML mode, linkedDOM sets the default namespace to XHTML (`http://www.w3.org/1999/xhtml`)
- XML namespaces are not properly handled - `getElementsByTagNameNS` doesn't work as expected
- Elements with namespace prefixes (like `<custom:element>`) are treated as regular elements with colons in their tag names

### 2. **Case Sensitivity**
- Both HTML and XML modes preserve the original case of tag names
- `querySelector` with lowercase works for uppercase tags in HTML mode (as expected)
- XML mode properly requires exact case matching

### 3. **Entity Handling**
- HTML mode correctly handles HTML entities like `&nbsp;` and `&copy;`
- XML mode does NOT handle these entities - they remain as literal text (e.g., `&nbsp;` stays as `&nbsp;`)
- Both modes handle basic XML entities (`&lt;`, `&gt;`, `&amp;`)

### 4. **CDATA Sections**
- XML mode properly handles CDATA sections, treating content as text
- HTML mode appears to ignore/strip CDATA sections entirely

### 5. **Error Handling**
- LinkedDOM is more forgiving than a real XML parser
- Malformed XML doesn't produce parse errors or `<parsererror>` elements
- Both modes try to parse malformed content as best they can

### 6. **Attributes**
- Duplicate attributes: Only the first one is kept (in both modes)
- Unquoted attributes work in both modes (should only work in HTML)

## Practical Implications

When using linkedDOM for EPUB processing:
1. **Be careful with XML namespaces** - they won't work as expected
2. **Entity handling differs** - XML mode won't decode HTML entities
3. **No strict XML validation** - malformed XML won't throw errors
4. **XHTML namespace is automatically applied** in XML mode

## Recommendations

For EPUB processing specifically:
- Use XML mode for content that needs to preserve CDATA
- Be aware that namespace handling is limited
- Don't rely on XML validation - linkedDOM is permissive
- Handle HTML entities manually in XML mode if needed