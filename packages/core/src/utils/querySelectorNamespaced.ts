export interface QuerySelectorTarget<T extends Element = Element> {
  querySelector: (selector: string) => T | null;
}

/**
 * Query selector helper for namespaced attributes that works across different browser environments
 * @param element - The element to query within
 * @param tag - The tag name to search for
 * @param attribute - The attribute to match (e.g., 'type="toc"')
 * @param ns - Optional namespace prefix (e.g., 'epub')
 * @returns The first matching element or null
 */
export function querySelectorNamespaced<T extends Element = Element>(
  element: QuerySelectorTarget<T>,
  tag: string,
  attribute: string,
  ns?: string | null,
): T | null {
  // Build the selectors to try
  const selectors: string[] = [];

  if (ns) {
    // Try with escaped namespace prefix
    selectors.push(`${tag}[${ns}\\:${attribute}]`);
    // Try with wildcard namespace
    selectors.push(`${tag}[*|${attribute}]`);
  }

  // Always try without namespace as fallback
  selectors.push(`${tag}[${attribute}]`);

  // Try each selector until one works
  for (const selector of selectors) {
    const result = element.querySelector(selector);
    if (result) {
      return result;
    }
  }

  return null;
}
