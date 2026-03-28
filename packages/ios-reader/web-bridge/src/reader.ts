/**
 * Scroll tracking and link interception for WKWebView communication.
 * Posts messages to window.webkit.messageHandlers when available (iOS),
 * otherwise logs to console (browser dev).
 */

function postToNative(handler: string, data: unknown): void {
  const handlers = window.webkit?.messageHandlers;
  const h = handlers?.[handler as keyof typeof handlers];
  if (h) {
    h.postMessage(data);
  }
}

/** Report current scroll fraction to native. */
function reportScroll(): void {
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  const fraction = maxScroll > 0 ? window.scrollY / maxScroll : 0;
  postToNative("scroll", { fraction: Math.min(1, Math.max(0, fraction)) });
}

/** Set scroll position by fraction (0.0–1.0). Called from native via evaluateJavaScript. */
export function setScrollFraction(f: number): void {
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  window.scrollTo({ top: f * maxScroll, behavior: "instant" });
}

/** Initialize scroll tracking. */
export function initScrollTracking(): void {
  let ticking = false;
  window.addEventListener("scroll", () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        reportScroll();
        ticking = false;
      });
      ticking = true;
    }
  });
}

/** Initialize link interception. */
export function initLinkInterception(): void {
  document.addEventListener("click", (e) => {
    const a = (e.target as HTMLElement).closest("a");
    if (!a) return;
    const href = a.getAttribute("href");
    if (!href) return;

    // Let external links open normally in dev mode
    if (!window.webkit?.messageHandlers?.link) return;

    e.preventDefault();
    postToNative("link", { href });
  });
}

// Expose for native
(window as Record<string, unknown>).setScrollFraction = setScrollFraction;
