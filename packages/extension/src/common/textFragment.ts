/**
 * Generate Text Fragment URLs for deep linking
 * https://web.dev/text-fragments/
 */

export function toTextFragmentUrl(url: string, selection: string): string {
  try {
    // Take first ~120 characters of selection for the fragment
    // Normalize whitespace for better matching
    const snippet = selection.slice(0, 120).trim().replace(/\s+/g, " ");
    if (!snippet) return url;

    // Encode the snippet
    const encoded = encodeURIComponent(snippet);

    // Parse URL and add text fragment
    const urlObj = new URL(url);

    // Preserve existing hash if present
    // Text fragments should be appended after existing hash with :~:
    const existingHash = urlObj.hash.slice(1); // Remove leading #
    if (existingHash && !existingHash.includes(":~:")) {
      // Has existing hash but no text fragment yet
      urlObj.hash = `${existingHash}:~:text=${encoded}`;
    } else {
      // No existing hash, or already has a text fragment
      urlObj.hash = `:~:text=${encoded}`;
    }

    return urlObj.toString();
  } catch {
    // If URL parsing fails, return original URL
    return url;
  }
}
