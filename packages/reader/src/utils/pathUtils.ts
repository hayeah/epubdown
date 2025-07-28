/**
 * Join a base path with a relative path, handling various edge cases
 * This is a browser-compatible path join utility
 */
export const joinPath = (base: string, path: string): string => {
  if (!base) return path;
  if (path.startsWith("/")) return path;

  const baseParts = base.split("/").filter(Boolean);
  const pathParts = path.split("/").filter(Boolean);

  // Remove filename from base if present
  if (baseParts.length > 0 && baseParts[baseParts.length - 1]?.includes(".")) {
    baseParts.pop();
  }

  // Handle relative paths
  for (const part of pathParts) {
    if (part === "..") {
      baseParts.pop();
    } else if (part !== ".") {
      baseParts.push(part);
    }
  }

  return baseParts.join("/");
};

/**
 * Extract the path portion of an href (without fragment)
 */
export const getHrefPath = (href: string): string => {
  return href.split("#")[0] || "";
};

/**
 * Resolve a TOC href to an absolute path using the TOC base
 */
export const resolveTocHref = (tocBase: string, href: string): string => {
  const hrefPath = getHrefPath(href);
  return tocBase ? joinPath(tocBase, hrefPath) : hrefPath;
};
