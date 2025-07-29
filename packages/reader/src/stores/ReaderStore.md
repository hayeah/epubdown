# ReaderStore Notes

## Book Switching Flash Fix

### Problem
When switching between books, there was a brief moment where the previous book's content was still visible before the new book loaded. This happened because:

1. The URL would change to a new book ID
2. ReaderPage's useEffect would trigger to load the new book
3. During the loading time, the old book's content was still displayed because the `epub` state still contained the old book

### Initial Solution Issue
The initial fix of always calling `reset()` at the beginning of `loadBookFromLibrary` caused a new problem:
- When switching chapters within the same book, the URL change triggered `loadBookFromLibrary` again
- This caused the entire book to be reset and reloaded, creating a flash during chapter navigation

### Final Solution
Track the current book ID and only reset when actually switching to a different book:

1. Added `currentBookId` property to ReaderStore
2. In `loadBookFromLibrary`, check if the new bookId differs from `currentBookId`
3. Only call `reset()` and reload the book if it's actually a different book
4. For chapter changes within the same book, just update the chapter index

This ensures:
- No flash when switching between books (old content is cleared immediately)
- No flash when switching between chapters (book isn't reloaded)

### Implementation Details
- Added `currentBookId: string | null` to track the currently loaded book
- Compare `this.currentBookId !== bookId` to detect book changes
- Only reset and reload when it's actually a different book
- Update `currentBookId` after successfully loading a new book