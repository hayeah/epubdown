import { posix as path } from "node:path";

/**
 * Normalize a path by resolving relative segments and ensuring it starts with /
 * @param base Base path (directory) for relative resolution
 * @param href Path to resolve (can be relative or absolute)
 * @returns Absolute path starting with /
 */
export function normalizePath(base: string, href: string): string {
  // If href is already absolute, return it
  if (href.startsWith("/")) {
    return href;
  }

  // If href is just a fragment, return it unchanged
  if (href.startsWith("#")) {
    return href;
  }

  // If href is an external URL, return it unchanged
  if (/^[a-z]+:\/\//i.test(href)) {
    return href;
  }

  // Split href to handle fragments
  const [relativePath, fragment] = href.split("#");
  const fragmentSuffix = fragment ? `#${fragment}` : "";

  // Ensure base starts with / for posix path operations
  const normalizedBase = base.startsWith("/") ? base : `/${base}`;

  // Use posix path.join to resolve the path properly
  // This handles . and .. segments, and normalizes slashes
  const resolved = path.join(normalizedBase, relativePath || "");

  // Ensure the result starts with / (path.join might remove it in some cases)
  const absolutePath = resolved.startsWith("/") ? resolved : `/${resolved}`;

  // Return with fragment if present
  return absolutePath + fragmentSuffix;
}
