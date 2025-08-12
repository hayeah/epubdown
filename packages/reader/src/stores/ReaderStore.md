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

## Text Selection Integration with Command Palette

### Overview
The ReaderStore now integrates with the CommandPaletteStore to provide a unified text selection experience in the reader. The old SelectionPopover component has been replaced with the Command Palette in selection mode.

### Key Components

1. **textSelect Event Binding**: The reader registers a `textSelect` event that listens for text selections within the reader container (`readerContainer`). When text is selected, it:
   - Extracts the selected text
   - Builds a list of context-specific commands
   - Opens the command palette in "selection" mode with the commands and range

2. **Selection Commands**: The `buildSelectionCommands` method creates context-aware actions for selected text:
   - **TLDR**: Generates a prompt for extracting key points from the selected text
   - **Simplify**: Creates a prompt with book/chapter context for simplifying text
   - **Copy**: Copies the selection with book/chapter metadata

3. **Command Actions**: Each command:
   - Calls `palette.restoreSelection()` to ensure the selection is still active
   - Builds an appropriate prompt using `buildPrompt`
   - Copies the result to the clipboard for use with AI tools or note-taking

### Selection Restoration
The `restoreSelection()` method is crucial - it ensures that when a command is executed, the original text selection is restored. This is necessary because:
- The palette may have caused the selection to be lost when it gained focus
- Actions need to operate on the original selected text
- The selection context needs to be preserved for accurate processing

### Visual Feedback
The CommandPalette component now renders selection overlay rectangles when in selection mode. These rectangles:
- Highlight the selected text with a blue overlay
- Are rendered at a lower z-index than the menu
- Automatically disappear when the palette closes

### Future Enhancements
The `getSelectionContext()` method is currently a stub but could be enhanced to:
- Extract surrounding paragraphs or sections
- Provide better context for the "simplify" action
- Include relevant headers or chapter sections