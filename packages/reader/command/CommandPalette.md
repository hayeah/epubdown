# Command Palette

A MobX store-driven command palette implementation with support for multiple display modes and smart positioning.

## Architecture

The command palette is built with the following components:

- **CommandPaletteStore**: MobX store managing all state and behavior
- **CommandPaletteProvider**: React context provider with built-in close triggers
- **CommandPalette**: Main UI component (observer)
- **CommandRow**: Individual command row component
- **SelectionOverlay**: Visual overlay for text selection mode

## Usage

### Basic Setup

```tsx
import { CommandPaletteProvider } from "./command/CommandPaletteContext";
import { CommandPalette } from "./command/CommandPalette";

function App() {
  return (
    <CommandPaletteProvider>
      {/* Your app content */}
      <CommandPalette />
    </CommandPaletteProvider>
  );
}
```

### Opening the Palette

Commands are passed when opening the palette, not registered beforehand:

```tsx
import { useCommandPaletteStore } from "./command/CommandPaletteContext";
import type { Command } from "./command/types";

function MyComponent() {
  const store = useCommandPaletteStore();
  
  const commands: Command[] = [
    {
      id: "search",
      label: "Search",
      icon: <SearchIcon />,
      shortcut: "⌘K",
      category: "Navigation",
      keywords: ["find", "look"],
      action: () => console.log("Search"),
      popularity: 0.9, // 0-1 ranking
    },
  ];

  // Different open modes
  store.openPalette(commands);  // Centered modal
  store.openMenu(commands, { anchorElement, position });  // Context menu
  store.openSlide(commands);  // Slide from top
  store.openSelection(commands, { range });  // Text selection menu
}
```

## Store API

### Public Properties

- `isOpen`: Whether the palette is currently open
- `mode`: Current display mode (`"palette"` | `"menu"` | `"slide"` | `"selection"`)
- `query`: Current search query
- `selectedIndex`: Currently selected command index
- `filtered`: Computed array of filtered/ranked commands
- `lastAction`: Label of the last executed command

### Public Methods

#### Opening Methods
- `openPalette(commands)`: Open as centered modal
- `openMenu(commands, opts)`: Open as context menu
- `openSlide(commands)`: Open sliding from top
- `openSelection(commands, opts)`: Open for text selection

#### Navigation Methods
- `setQuery(q)`: Update search query
- `moveSelection(delta)`: Move selection up/down
- `selectFirst()`: Select first command
- `selectLast()`: Select last command
- `executeSelected(onClose)`: Execute selected command
- `close()`: Close the palette

#### Utility Methods
- `touchUsage(id)`: Update command's last used timestamp
- `restoreSelection()`: Restore saved text selection (for selection mode)

## Display Modes

### Palette Mode
- Centered modal with backdrop
- Width: 560px
- Search enabled by default
- Keyboard shortcut: typically ⌘K

### Menu Mode
- Context menu anchored to element or position
- Width: 320px
- No backdrop
- Closes on outside click

### Slide Mode
- Slides down from top of viewport
- Width: 480px
- Fixed 10px from top
- Search enabled

### Selection Mode
- Positioned relative to text selection
- Width: 320px
- Shows visual overlay on selected text
- Preserves selection for actions

## Event Flow

### Opening
1. App calls `store.openPalette(commands)` or similar
2. Store sets mode, width, and positioning data
3. Store computes menu position via `computeMenuXY()`
4. Component renders with computed position

### Closing
Built-in triggers in the provider:
- Escape key (all modes)
- Scroll (selection mode only)
- Click outside (menu/selection modes)
- Backdrop click (palette mode)

App-controlled closing:
- Call `store.close()` directly
- Execute a command (auto-closes)

### Command Execution
1. User selects command (keyboard/mouse)
2. Command's `action()` is called
3. `lastAction` is updated
4. Command usage is tracked
5. Palette closes automatically

## Positioning Logic

### Position Calculation
- **Palette**: Centered horizontally, 1/3 from top
- **Menu**: Smart positioning relative to anchor/cursor
- **Slide**: Centered horizontally, 10px from top
- **Selection**: Above/beside selection to avoid obscuring text

### When Positioning Runs
- On initial open
- When window resizes (via layout effects)
- When mode changes
- When selection rect updates

The store's `computeMenuXY()` method handles all positioning logic, using the bound menu element reference for measurements.

## Command Ranking

Commands are ranked by multiple factors:
1. **Text matching** (fuzzy match on label, keywords, category)
2. **Recency** (boost for recently used, up to +20 points)
3. **Popularity** (0-1 value, adds up to +10 points)
4. **Scope** (context commands get +30 boost)

## Migration from Prototype

Key changes from the original prototype:
1. All state moved to MobX store
2. Commands passed on open, not stored
3. Provider handles close triggers
4. App handles open triggers
5. Components are now observers
6. Positioning logic centralized in store

## Tips

- Wrap your app with `CommandPaletteProvider` once
- Render `<CommandPalette />` once at app level
- Pass commands when opening, don't pre-register
- Use `popularity` field for frequently used commands
- `lastUsed` is automatically managed
- Context commands should have `scope: "context"`
- Icons should be 16x16 (w-4 h-4 in Tailwind)