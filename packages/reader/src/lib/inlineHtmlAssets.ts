import { normalizePath, type EPub, type DOMFile } from "@epubdown/core";

export async function inlineChapterHTML(epub: EPub, chapter: DOMFile) {
  const doc = chapter.dom.cloneNode(true) as Document;
  const urlsToRevoke: string[] = [];

  // Inline <link rel="stylesheet">
  for (const link of Array.from(
    doc.querySelectorAll('link[rel="stylesheet"][href]'),
  )) {
    const href = link.getAttribute("href");
    if (!href) continue;
    const abs = normalizePath(chapter.base, href);
    const css = (await epub.resolver.read(abs)) ?? "";
    const style = doc.createElement("style");
    style.setAttribute("data-inlined", abs);
    style.textContent = await rewriteCssUrls(css, abs, async (u) =>
      toBlobUrl(
        epub,
        normalizePath(abs.replace(/[^/]+$/, ""), u),
        urlsToRevoke,
      ),
    );
    link.replaceWith(style);
  }

  // Preserve existing <style> tags (they should already be present in the DOM)

  // Rewrite <img src>
  for (const img of Array.from(doc.querySelectorAll("img[src]"))) {
    const src = img.getAttribute("src");
    if (!src || /^(https?:|data:|blob:)/i.test(src)) continue;
    const abs = normalizePath(chapter.base, src);
    img.setAttribute("src", await toBlobUrl(epub, abs, urlsToRevoke));
  }

  // Rewrite <image xlink:href> for SVGs
  for (const image of Array.from(doc.querySelectorAll("image"))) {
    const href = image.getAttribute("xlink:href") || image.getAttribute("href");
    if (!href || /^(https?:|data:|blob:)/i.test(href)) continue;
    const abs = normalizePath(chapter.base, href);
    const blobUrl = await toBlobUrl(epub, abs, urlsToRevoke);
    image.setAttribute("xlink:href", blobUrl);
    image.setAttribute("href", blobUrl);
  }

  const html = doc.body ? doc.body.innerHTML : doc.documentElement.outerHTML;
  return { html, urlsToRevoke };
}

async function toBlobUrl(epub: EPub, abs: string, bag: string[]) {
  const bytes = await epub.resolver.readRaw(abs);
  if (!bytes) return abs; // fallback
  const ext = abs.split(".").pop()?.toLowerCase();
  const mime =
    ext === "png"
      ? "image/png"
      : ext === "jpg" || ext === "jpeg"
        ? "image/jpeg"
        : ext === "gif"
          ? "image/gif"
          : ext === "webp"
            ? "image/webp"
            : ext === "svg"
              ? "image/svg+xml"
              : ext === "css"
                ? "text/css"
                : ext === "woff"
                  ? "font/woff"
                  : ext === "woff2"
                    ? "font/woff2"
                    : ext === "ttf"
                      ? "font/ttf"
                      : ext === "otf"
                        ? "font/otf"
                        : "application/octet-stream";
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  bag.push(url);
  return url;
}

async function rewriteCssUrls(
  css: string,
  cssPath: string,
  mapUrl: (u: string) => Promise<string>,
) {
  // Handle url() calls in CSS
  const urlRE = /url\(([^)]+)\)/g;
  const parts: string[] = [];
  let last = 0;
  let match: RegExpExecArray | null;

  // biome-ignore lint/suspicious/noAssignInExpressions: exec pattern is standard
  while ((match = urlRE.exec(css))) {
    const index = match.index ?? 0;
    parts.push(css.slice(last, index));
    const raw = (match[1] || "").trim().replace(/^['"]|['"]$/g, "");
    const mapped = raw.match(/^(https?:|data:|blob:)/i)
      ? raw
      : await mapUrl(raw);
    parts.push(`url("${mapped}")`);
    last = index + match[0].length;
  }
  parts.push(css.slice(last));
  return parts.join("");
}
