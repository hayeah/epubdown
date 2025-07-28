# Sidebar Component - Positioning Strategy

## Overview

The Sidebar component uses a clever positioning technique that combines `sticky` and `absolute` positioning to achieve a "fixed-like" behavior that's anchored to its parent container rather than the viewport.

## How It Works

### 1. Sticky Anchor (in ReaderPage.tsx)

```tsx
<div className="sticky top-0 h-0 relative">
  <Sidebar ... />
</div>
```

- **`sticky top-0`**: Makes this wrapper stick to the top of the viewport when scrolled
- **`h-0`**: Zero height ensures it doesn't affect document flow
- **`relative`**: Creates a positioning context for absolute children

### 2. Absolute Sidebar (in Sidebar.tsx)

```tsx
<div className={`absolute left-0 top-0 ${isOpen ? "w-80" : "w-0"} h-screen pointer-events-auto`}>
```

- **`absolute left-0 top-0`**: Positions relative to the sticky anchor
- **`h-screen`**: Full viewport height
- **`pointer-events-auto`**: Ensures clicks work despite parent's zero height

## Benefits

1. **No JavaScript resize listeners needed** - The sidebar automatically stays aligned with the centered content column
2. **Smooth animations** - Width transitions from 0 to 320px create a slide-in effect
3. **Clean overflow** - The sidebar overlays content instead of pushing it
4. **Responsive positioning** - Works seamlessly across different screen sizes

## Visual Behavior

- When closed: Width animates to 0, effectively hiding the sidebar
- When open: Width expands to 320px (w-80), overlaying the content
- The sidebar appears "fixed" but is actually positioned relative to the content container
- Scrolling the page keeps the sidebar in view once the sticky anchor reaches the top