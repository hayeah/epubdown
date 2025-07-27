# markdownToReact Implementation Notes

## x-image Tag Handling

### Important: Use Explicit Closing Tags
The `html-react-parser` library doesn't recognize custom tags like `x-image` as void/self-closing elements. If we use self-closing syntax `<x-image />`, the parser will incorrectly treat all subsequent content as children of the x-image element, causing content to appear truncated.

### Solution
Always use explicit closing tags for x-image elements:
- ✅ Correct: `<x-image src="..." alt="..."></x-image>`
- ❌ Incorrect: `<x-image src="..." alt="..." />`

This is enforced in the `ContentToMarkdown` converter in the core package, which generates x-image tags with explicit closing tags to avoid this parsing issue.