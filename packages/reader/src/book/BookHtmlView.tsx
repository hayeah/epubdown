// BookHtmlView.tsx
import { observer } from "mobx-react-lite";
import { useEffect, useRef } from "react";
import tailwindBaseCSS from "./tailwind-base.css?inline";
import { inlineChapterHTML } from "../lib/inlineHtmlAssets";
import type { EPub, DOMFile } from "@epubdown/core";

export interface BookHtmlViewProps {
  epub: EPub;
  chapter: DOMFile;
  onNavigate: (absPath: string) => void;
}

export const BookHtmlView = observer(function BookHtmlView({
  epub,
  chapter,
  onNavigate,
}: BookHtmlViewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const lastCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!hostRef.current) return;
    let cancelled = false;

    // Build and install the HTML for this chapter
    (async () => {
      // Revoke previous blob URLs BEFORE installing new HTML
      lastCleanupRef.current?.();
      lastCleanupRef.current = null;

      const { html, cleanup } = await inlineChapterHTML(epub, chapter);
      if (cancelled) {
        cleanup?.(); // don’t leak if we bailed mid-flight
        return;
      }

      let shadow = hostRef.current!.shadowRoot;
      if (!shadow) shadow = hostRef.current!.attachShadow({ mode: "open" });
      else shadow.innerHTML = "";

      const styles = document.createElement("style");
      styles.textContent = tailwindBaseCSS + `
        .chapter-html-body{max-width:100%;overflow-x:auto}
        img{max-width:100%;height:auto}
        pre{overflow-x:auto}
        table{border-collapse:collapse}
      `;

      const wrapper = document.createElement("div");
      wrapper.className = "chapter-html-body";
      wrapper.innerHTML = html;

      shadow.appendChild(styles);
      shadow.appendChild(wrapper);

      const onClick = (e: MouseEvent) => {
        const a = (e.target as HTMLElement).closest("a") as
          | HTMLAnchorElement
          | null;
        if (!a) return;
        const href = a.getAttribute("href") || "";
        if (!href) return;
        if (href.startsWith("http") || href.startsWith("mailto:")) return;
        if (href.startsWith("#")) return;
        e.preventDefault();
        onNavigate(href);
      };

      shadow.addEventListener("click", onClick as EventListener);
      // Keep cleanup that revokes current blob URLs;
      // also remove our click handler when we replace/unmount.
      lastCleanupRef.current = () => {
        shadow!.removeEventListener("click", onClick as EventListener);
        cleanup?.();
      };
    })();

    // Don’t revoke here; StrictMode would kill the fresh URLs immediately.
    return () => {
      cancelled = true;
    };
  }, [epub, chapter, onNavigate]); // intentionally not dependent on cleanup

  // True-unmount cleanup
  useEffect(() => {
    return () => {
      lastCleanupRef.current?.();
      lastCleanupRef.current = null;
    };
  }, []);

  return (
    <div className="epub-chapter">
      <div className="chapter-content" ref={hostRef} />
    </div>
  );
});
