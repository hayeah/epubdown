/**
 * Utility for parsing markdown files with optional YAML frontmatter
 */

export interface ParsedMarkdown {
  title?: string;
  frontmatter?: Record<string, unknown>;
  content: string;
}

/**
 * Simple YAML frontmatter parser
 * Handles basic key: value pairs, arrays, and strings
 */
function parseYamlFrontmatter(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = yaml.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const colonIndex = trimmed.indexOf(":");
    if (colonIndex === -1) continue;

    const key = trimmed.slice(0, colonIndex).trim();
    let value: unknown = trimmed.slice(colonIndex + 1).trim();

    // Remove surrounding quotes if present
    if (typeof value === "string") {
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      // Parse arrays (simple single-line format: [a, b, c])
      if (
        typeof value === "string" &&
        value.startsWith("[") &&
        value.endsWith("]")
      ) {
        value = value
          .slice(1, -1)
          .split(",")
          .map((s) => s.trim().replace(/^["']|["']$/g, ""));
      }

      // Parse booleans
      if (value === "true") value = true;
      else if (value === "false") value = false;
      // Parse numbers
      else if (typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value)) {
        value = Number.parseFloat(value);
      }
    }

    if (key) {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Extract the first heading from markdown content
 */
function extractFirstHeading(content: string): string | undefined {
  // Match # Heading, ## Heading, etc.
  const headingMatch = content.match(/^#{1,6}\s+(.+)$/m);
  const headingText = headingMatch?.[1];
  if (headingText) {
    return headingText.trim();
  }

  // Also try to match underline-style headings
  const underlineMatch = content.match(/^(.+)\n[=]+\s*$/m);
  const underlineText = underlineMatch?.[1];
  if (underlineText) {
    return underlineText.trim();
  }

  return undefined;
}

/**
 * Extract all headings from markdown content for TOC generation
 * Skips headings inside code blocks
 */
export function extractHeadings(
  content: string,
): Array<{ level: number; text: string }> {
  const headings: Array<{ level: number; text: string }> = [];

  // Remove fenced code blocks before extracting headings
  // This prevents matching # comments inside code blocks
  const contentWithoutCodeBlocks = content.replace(/```[\s\S]*?```/g, "");

  // Match ATX-style headings (# Heading)
  const atxRegex = /^(#{1,6})\s+(.+)$/gm;
  let match: RegExpExecArray | null;

  while ((match = atxRegex.exec(contentWithoutCodeBlocks)) !== null) {
    const hashes = match[1];
    const text = match[2];
    if (hashes && text) {
      headings.push({
        level: hashes.length,
        text: text.trim(),
      });
    }
  }

  return headings;
}

/**
 * Parse a markdown file, extracting frontmatter and content
 */
export function parseMarkdownFile(raw: string): ParsedMarkdown {
  const trimmed = raw.trimStart();

  // Check for YAML frontmatter (starts with ---)
  if (!trimmed.startsWith("---")) {
    // No frontmatter, just extract title from first heading
    return {
      title: extractFirstHeading(raw),
      content: raw,
    };
  }

  // Find the closing ---
  const endIndex = trimmed.indexOf("\n---", 3);
  if (endIndex === -1) {
    // Malformed frontmatter, treat as regular content
    return {
      title: extractFirstHeading(raw),
      content: raw,
    };
  }

  const yamlContent = trimmed.slice(4, endIndex);
  const content = trimmed.slice(endIndex + 4).trimStart();

  const frontmatter = parseYamlFrontmatter(yamlContent);

  // Extract title from frontmatter or fall back to first heading
  let title: string | undefined;
  if (typeof frontmatter.title === "string") {
    title = frontmatter.title;
  } else {
    title = extractFirstHeading(content);
  }

  return {
    title,
    frontmatter,
    content,
  };
}

/**
 * Determine the file type based on extension
 */
export function getFileType(
  filename: string,
): "markdown" | "image" | "other" | null {
  const ext = filename.toLowerCase().split(".").pop() ?? "";

  const markdownExtensions = ["md", "markdown", "mdx", "txt"];
  const imageExtensions = ["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp"];
  const ignoredExtensions = ["exe", "dll", "so", "dylib", "zip", "tar", "gz"];

  if (ignoredExtensions.includes(ext)) {
    return null; // Filter out
  }

  if (markdownExtensions.includes(ext)) {
    return "markdown";
  }

  if (imageExtensions.includes(ext)) {
    return "image";
  }

  return "other";
}
