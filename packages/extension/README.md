# Copy with Context - Chrome Extension

A Chrome MV3 extension that allows users to copy selected text with smart surrounding context for ChatGPT analysis.

## Features

- **Smart Context Extraction**: Automatically extracts relevant surrounding text from web pages
- **ChatGPT Integration**: Formats context into a ready-to-use ChatGPT prompt
- **Outline Display**: Shows ChatGPT's outline overlay on the original page
- **Text Fragment Links**: Generates deep links back to the original selection

## Development

### Prerequisites

- Node.js 18+
- pnpm 10.x

### Setup

```bash
# Install dependencies
pnpm install

# Build the extension
pnpm -C packages/extension build

# Or watch for changes during development
pnpm -C packages/extension dev
```

### Loading in Chrome (Development)

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked"
4. Select the `packages/extension/dist` directory

### Packaging for Distribution

To create a .zip file that can be shared or submitted to the Chrome Web Store:

```bash
# Build and package the extension
pnpm -C packages/extension package
```

This will create `extension-v0.1.0.zip` (or whatever version is in package.json) in the `packages/extension/` directory.

**To install the packaged extension:**
1. Share the .zip file with others
2. They extract it to a folder
3. Follow the "Loading in Chrome" steps above, selecting the extracted folder

**For Chrome Web Store submission:**
1. Upload the .zip file directly to the Chrome Web Store Developer Dashboard
2. No need to extract - Chrome Web Store accepts .zip files

### Project Structure

```
packages/extension/
├── src/
│   ├── background/       # Service worker
│   ├── content/          # Content scripts
│   ├── panel/            # Side panel UI
│   ├── popup/            # Extension popup
│   ├── common/           # Shared utilities
│   └── assets/           # Icons and images
├── manifest.json         # Extension manifest
├── vite.config.ts        # Build configuration
└── package.json
```

## Usage

1. Select text on any webpage
2. Right-click and choose "Copy with context"
3. The extension captures the selection + surrounding context
4. A formatted ChatGPT prompt is copied to your clipboard
5. Paste into ChatGPT to get an outline
6. Open the side panel to paste the outline back
7. The outline appears as an overlay on the original page

## Technical Details

- **Manifest Version**: 3
- **Framework**: React 19 for UI components
- **Build Tool**: Vite
- **Context Extraction**: Adapted from @epubdown/reader's SelectionContextExtractor
- **Storage**: chrome.storage.session for ephemeral captures, chrome.storage.local for settings
- **Overlay**: Shadow DOM to avoid CSS conflicts with host pages

## Icons

The current icons are SVG placeholders. For production, replace files in `src/assets/` with proper PNG icons:
- `icon16.png` (16x16)
- `icon48.png` (48x48)
- `icon128.png` (128x128)

Generate icons by running:
```bash
bun packages/extension/scripts/generate-icons.ts
```

## License

Private - Part of the epubdown monorepo
