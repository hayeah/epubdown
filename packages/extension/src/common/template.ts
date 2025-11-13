/**
 * Simple mustache-style template renderer
 * Adapted from MinimalTemplate.ts
 */

export function renderTemplate(
  template: string,
  context: Record<string, unknown>,
): string {
  const MUSTACHE = /{{\s*([^}]+?)\s*}}/g;
  return template.replace(MUSTACHE, (match, key) => {
    const trimmedKey = key.trim();
    const value = context[trimmedKey];
    return value != null ? String(value) : "";
  });
}
