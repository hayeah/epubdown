# ReaderStore Notes

## Book Switching Flash Fix

### Problem
When switching between books, there was a brief moment where the previous book's content was still visible before the new book loaded. This happened because:

1. The URL would change to a new book ID
2. ReaderPage's useEffect would trigger to load the new book
3. During the loading time, the old book's content was still displayed because the `epub` state still contained the old book

### Solution
Simply call `reset()` at the beginning of `loadBookFromLibrary` to always clear the previous book's state before loading a new one.

This ensures that the old book's content is cleared immediately when loading any book, preventing the flash of old content during the loading process.

### Implementation Details
- Call `reset()` at the start of `loadBookFromLibrary()`
- This clears all book state (epub, chapters, metadata, etc.) before loading the new book
- Simple and effective - no need to track which book is currently loaded