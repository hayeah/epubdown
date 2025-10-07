import { useEffect, useRef } from "react";
import { observer } from "mobx-react-lite";
import tailwindBaseCSS from "./tailwind-base.css?inline";

export interface BookHtmlViewProps {
  html: string;
  cleanup?: () => void;
  onNavigate: (absPath: string) => void;
}

export const BookHtmlView = observer(function BookHtmlView({
  html,
  cleanup,
  onNavigate,
}: BookHtmlViewProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hostRef.current) return;

    // Check if shadow root already exists, if so use it, otherwise create new one
    let shadow = hostRef.current.shadowRoot;
    if (!shadow) {
      shadow = hostRef.current.attachShadow({ mode: "open" });
    } else {
      // Clear existing content
      shadow.innerHTML = "";
    }

    // Create wrapper for author HTML
    const wrapper = document.createElement("div");
    wrapper.className = "chapter-html-body";
    wrapper.innerHTML = html;

    // Create styles element with Tailwind base reset
    const stylesElement = document.createElement("style");

    // Combine Tailwind base with additional reader-specific styles
    const additionalStyles = `
      /* Additional reader-specific styles */
      .chapter-html-body {
        max-width: 100%;
        overflow-x: auto;
      }

      /* Ensure images don't overflow */
      img {
        max-width: 100%;
        height: auto;
      }

      /* Ensure pre blocks are scrollable */
      pre {
        overflow-x: auto;
      }

      /* Table styling */
      table {
        border-collapse: collapse;
      }
    `;

    stylesElement.textContent = tailwindBaseCSS + additionalStyles;
    shadow.appendChild(stylesElement);
    shadow.appendChild(wrapper);

    // Link interception
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest(
        "a",
      ) as HTMLAnchorElement | null;
      if (!a || !a.getAttribute) return;

      const href = a.getAttribute("href") || "";
      if (!href) return;

      // Allow external links to open normally
      if (href.startsWith("http") || href.startsWith("mailto:")) return;

      // Allow same-document fragments
      if (href.startsWith("#")) {
        // Let browser handle fragment navigation within shadow DOM
        return;
      }

      // Intercept internal navigation
      e.preventDefault();
      onNavigate(href);
    };

    shadow.addEventListener("click", onClick as EventListener);

    return () => {
      shadow.removeEventListener("click", onClick as EventListener);
      // Call cleanup to revoke blob URLs if provided
      cleanup?.();
    };
  }, [html, onNavigate, cleanup]);

  // Keep the same container classes so ReadingProgressStore and selection utils still work
  return (
    <div className="epub-chapter">
      <div className="chapter-content" ref={hostRef} />
    </div>
  );
});
