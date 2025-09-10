
# TypeScript Style (OpenAI Codex)

- when defining optional parameter, no need to explicitly say `string | null`
	- BAD: `inputString?:  string | null`
	- GOOD: `inputString?:  string`

- take advantage of typescript's nullable chain
	- BAD: `const contentType = manifestItem ? manifestItem.mediaType : undefined;
	- GOOD: `const contentType = manifestItem?.mediaType;

- for a value/function call that already has a nullable type, no need to force it to be undfined...
	- BAD: `const mediaType = navItem.getAttribute("media-type") || undefined;`
	- GOOD: `const mediaType = navItem.getAttribute("media-type")`
- when removing code, DO NOT leave a comment. Just remove it.
	- `// Removed readXMLFile in favor of readDOMFile`
- avoid casting value to any. e.g. `(resolver as any).fooMethod()`
- take advantage of typescript's nullable features
	- BAD: `const contentType = manifestItem ? manifestItem.mediaType : undefined;
	- GOOD: `const contentType = manifestItem?.mediaType;