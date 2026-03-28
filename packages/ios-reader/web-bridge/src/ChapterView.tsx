import { useEffect, useRef, useState } from "react";

/**
 * Renders EPUB chapter HTML content.
 * Listens for "epubbridge:renderchapter" custom events dispatched by bridge.ts.
 */
export function ChapterView() {
  const [html, setHTML] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onRender(e: Event) {
      const { html } = (e as CustomEvent).detail;
      setHTML(html);
      setLoading(false);
      // Scroll to top on chapter change
      window.scrollTo({ top: 0, behavior: "instant" });
    }

    window.addEventListener("epubbridge:renderchapter", onRender);
    return () => window.removeEventListener("epubbridge:renderchapter", onRender);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-dvh text-gray-400 bg-blue-50">
        Waiting for chapter...
      </div>
    );
  }

  return (
    <div
      ref={contentRef}
      className="chapter-content"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
