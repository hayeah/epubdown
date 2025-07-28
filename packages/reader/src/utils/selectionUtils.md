# Selection Utilities

This module provides functionality for the "copy with context" feature in the epub reader.

## Features

- **Text Selection with Context**: When text is selected, extracts surrounding context (200 words before and after by default)
- **Dynamic Context Allocation**: If there isn't enough text on one side, allocates more context to the other side
- **Popover UI**: Shows a "Copy with context" button when text is selected
- **Keyboard Shortcut**: Cmd+Shift+C (Mac) or Ctrl+Shift+C (Windows/Linux) for quick copy with context

## Implementation Details

### Context Extraction Algorithm

1. Uses TreeWalker API to traverse text nodes within the chapter container
2. Collects text before and after the selection
3. Limits context to specified word count (default 400 total, 200 before/after)
4. Dynamically reallocates word limits if one side has less text

### Formatted Output

The copied text follows this format:

```
Book Title: [Book Title]

## Context

[before context] <<[selected text]>> [after context]

## Selection

[selected text]
```

### UI Components

- **SelectionPopover**: Displays a floating button above text selections
- Automatically positions itself and hides on scroll
- Uses React portal for proper z-index management

### Integration

The feature is integrated into the BookReader component:
- Popover appears automatically when text is selected
- Keyboard shortcut is globally available while reading
- Works with the existing epub chapter rendering system