import { useEffect } from "react";

const APP_NAME = "Epubdown";
const DEFAULT_TITLE = APP_NAME;

/**
 * Hook to set the document title with consistent app branding.
 *
 * @param title - The page-specific title. If provided, formats as "Title - Epubdown".
 *                If null/undefined, sets title to just "Epubdown".
 *
 * @example
 * // Library page
 * useDocumentTitle("My Library");
 * // Result: "My Library - Epubdown"
 *
 * @example
 * // EPUB reader with chapter
 * useDocumentTitle("Chapter 1 | The Great Gatsby");
 * // Result: "Chapter 1 | The Great Gatsby - Epubdown"
 *
 * @example
 * // No title (uses default)
 * useDocumentTitle();
 * // Result: "Epubdown"
 */
export function useDocumentTitle(title?: string | null): void {
  useEffect(() => {
    if (title) {
      document.title = `${title} - ${APP_NAME}`;
    } else {
      document.title = DEFAULT_TITLE;
    }

    // Reset to default on unmount
    return () => {
      document.title = DEFAULT_TITLE;
    };
  }, [title]);
}
