// Wrapper to handle turndown import for both dev and build environments
let TurndownService;

try {
  // Try to import the built version
  TurndownService = (await import('turndown/lib/turndown.browser.es.js')).default;
} catch {
  try {
    // Fallback to source for development
    TurndownService = (await import('turndown/src/turndown.js')).default;
  } catch {
    // Final fallback
    TurndownService = (await import('turndown')).default;
  }
}

export default TurndownService;