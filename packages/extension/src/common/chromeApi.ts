/**
 * Centralized Chrome API access helper
 * Use this instead of directly accessing chrome/globalThis/window
 */

export function getChromeAPI(): typeof chrome {
  if (typeof chrome !== "undefined") {
    return chrome;
  }
  if (typeof globalThis !== "undefined" && "chrome" in globalThis) {
    return (globalThis as any).chrome;
  }
  if (typeof window !== "undefined" && "chrome" in window) {
    return (window as any).chrome;
  }
  throw new Error("Chrome API not available");
}
