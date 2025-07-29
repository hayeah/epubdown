# Image Component Refactoring Notes

## Current Architecture
- ChapterRenderer passes XMLFile to EPubResolverProvider
- Image component uses useEPubResolver() to get the resolver
- Image component manually loads image data using resolver.readRaw()

## Proposed Architecture
- Remove EPubResolverProvider
- Image component uses useReaderStore() directly
- Get current chapter from store: readerStore.currentChapter
- Use existing store method: readerStore.getImage(readerStore.currentChapter, src)

## Benefits
1. Removes extra context layer
2. Reuses existing store logic for image loading
3. Centralizes image caching in the store (if implemented)
4. Simplifies component hierarchy