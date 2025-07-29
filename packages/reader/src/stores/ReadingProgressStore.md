# ReadingProgressStore Notes

## Overview
The `ReadingProgressStore` class handles tracking reading progress using Intersection Observer and manages URL hash updates for scroll position restoration.

## Key Features

### 1. Singleton Pattern
- Single instance ensures only one observer is active at a time
- Accessed via `useReadingProgress()` hook

### 2. Reading Progress Tracking
- Uses IntersectionObserver to track visible blocks (paragraphs, headings, etc.)
- Updates URL hash in format `#p_{index}` as user scrolls
- Configurable rootMargin ensures detection happens when content is near top of viewport

### 3. Scroll Restoration
- Parses position from URL hash on page load
- Waits for content to render before scrolling to saved position
- Extracts blocks dynamically to handle async content loading

### 4. Block Selection Logic
- Tracks semantic content blocks: p, h1-h6, ul, ol, blockquote, pre, img, table, hr
- Skips table cells (td, th) and list items (li) as they're part of larger blocks
- Skips nested list items to avoid duplicate tracking

## Implementation Details

### Hash Format
- Reading position: `#p_{blockIndex}` (e.g., `#p_42`)
- Combined with chapter hash: `#chapter-id#p_42`

### Observer Configuration
```typescript
{
  rootMargin: "0px 0px -80% 0px",  // Trigger when 20% from top
  threshold: 0                      // Any visibility triggers
}
```

### Usage Pattern
```typescript
// In ChapterRenderer - Start tracking and restore position
readingProgress.startTracking(contentEl);
readingProgress.restoreScrollPosition();
```

## Edge Cases Handled
1. Position 0 is ignored (top of page, no need to scroll)
2. Assumes content is already rendered when restoreScrollPosition is called
3. Cleans up observer on unmount to prevent memory leaks
4. Handles missing blocks gracefully

## Refactoring Benefits
1. No redundant callback - ReadingProgressStore handles URL updates directly
2. No setTimeout - scroll restoration happens synchronously after content is tracked
3. Cleaner API - startTracking doesn't need a callback or ReaderStore reference
4. Single responsibility - ReaderStore no longer manages reading position