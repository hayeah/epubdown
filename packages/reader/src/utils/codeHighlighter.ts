import { createHighlighter, type Highlighter } from "shiki";

let highlighterPromise: Promise<Highlighter> | null = null;

/**
 * Get or create a singleton highlighter instance
 */
async function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ["github-light", "github-dark"],
      langs: [
        "javascript",
        "typescript",
        "jsx",
        "tsx",
        "json",
        "html",
        "css",
        "markdown",
        "bash",
        "shell",
        "python",
        "rust",
        "go",
        "java",
        "c",
        "cpp",
        "sql",
        "yaml",
        "toml",
        "xml",
        "diff",
      ],
    });
  }
  return highlighterPromise;
}

/**
 * Highlight code with shiki
 */
export async function highlightCode(
  code: string,
  lang: string,
): Promise<string> {
  const highlighter = await getHighlighter();

  // Normalize language name
  const normalizedLang = normalizeLanguage(lang);

  // Check if language is supported
  const loadedLangs = highlighter.getLoadedLanguages();
  const isSupported = loadedLangs.includes(normalizedLang as any);

  if (!isSupported) {
    // Return plain code block if language not supported
    return `<pre class="shiki"><code>${escapeHtml(code)}</code></pre>`;
  }

  return highlighter.codeToHtml(code, {
    lang: normalizedLang,
    theme: "github-light",
  });
}

/**
 * Normalize common language aliases
 */
function normalizeLanguage(lang: string): string {
  const aliases: Record<string, string> = {
    js: "javascript",
    ts: "typescript",
    py: "python",
    rb: "ruby",
    sh: "bash",
    zsh: "bash",
    yml: "yaml",
    "c++": "cpp",
    "c#": "csharp",
    rs: "rust",
    md: "markdown",
  };

  const lower = lang.toLowerCase();
  return aliases[lower] || lower;
}

/**
 * Escape HTML entities
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
