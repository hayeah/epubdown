# EPubShortener Notes

## Image Stripping Implementation

The image stripping functionality is integrated into the XmlAnonymizer class. When `stripImages` is enabled:

1. All `<img>` and `<image>` (SVG) elements are replaced with text nodes containing `[image src: <path>]`
2. The actual image files are deleted from the filesystem after all chapters are processed
3. The `[image src: ...]` markers are preserved during text anonymization

## Current Implementation

The EPubShortener module exports two functions that use XmlAnonymizer directly:
- `shortenDir`: Processes an extracted EPUB directory
- `shorten`: Processes a zipped EPUB file

### XmlAnonymizer Updates
- Added `XmlAnonymizerOptions` interface with options including `stripImages` and `basePath`
- Changed `strippedImagePaths` from array to Set for better performance
- Image stripping happens before text anonymization
- Special text pattern `[image src: ...]` is preserved during anonymization
- Provides `getStrippedImagePaths()` method to retrieve image paths
- `basePath` option helps track where images are located for deletion

### Processing Flow
1. Create XmlAnonymizer with appropriate mode (xml/html) and options
2. Pass `chapter.base` as `basePath` to XmlAnonymizer for correct path resolution
3. Create EPubShortener with the anonymizer instance
4. Process each chapter:
   - Strip images (if enabled) - replaces img tags with text markers
   - Anonymize text content - preserves image markers
   - Write processed content back
   - Track image paths with their base directories
5. Delete image files using the full paths (base + image path)