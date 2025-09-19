import { useEffect, useRef } from "react";
import { observer } from "mobx-react-lite";

export interface BookHtmlViewProps {
  html: string;
  urlsToRevoke?: string[];
  onNavigate: (absPath: string) => void;
  theme?: "light" | "sepia" | "dark";
}

export const BookHtmlView = observer(function BookHtmlView({
  html,
  urlsToRevoke = [],
  onNavigate,
  theme = "light",
}: BookHtmlViewProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hostRef.current) return;
    const shadow = hostRef.current.attachShadow({ mode: "open" });

    // Create wrapper for author HTML
    const wrapper = document.createElement("div");
    wrapper.className = "chapter-html-body";
    wrapper.innerHTML = html;

    // Create theme style
    const themeStyle = document.createElement("style");

    // Base styles for reader overrides
    const baseStyles = `
      :host {
        font-family: system-ui, -apple-system, sans-serif;
        line-height: 1.6;
        word-break: break-word;
      }

      .chapter-html-body {
        max-width: 100%;
        overflow-x: auto;
      }

      img {
        max-width: 100%;
        height: auto;
      }

      pre {
        overflow-x: auto;
      }

      table {
        border-collapse: collapse;
      }
    `;

    // Theme-specific overrides
    if (theme === "dark") {
      themeStyle.textContent = `${baseStyles}
        :host {
          color-scheme: dark;
        }
        body, .chapter-html-body {
          background: #1a1a1a !important;
          color: #e6e6e6 !important;
        }
        a {
          color: #6db3d8 !important;
        }
        a:visited {
          color: #9d7fd8 !important;
        }
      `;
    } else if (theme === "sepia") {
      themeStyle.textContent = `${baseStyles}
        body, .chapter-html-body {
          background: #f4ecd8 !important;
          color: #3b2f2f !important;
        }
        a {
          color: #704214 !important;
        }
        a:visited {
          color: #8b5a3c !important;
        }
      `;
    } else {
      themeStyle.textContent = baseStyles;
    }

    shadow.appendChild(themeStyle);
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
      // Revoke blob URLs on cleanup
      for (const url of urlsToRevoke) {
        try {
          URL.revokeObjectURL(url);
        } catch {}
      }
    };
  }, [html, onNavigate, theme, urlsToRevoke]);

  // Keep the same container classes so ReadingProgressStore and selection utils still work
  return (
    <div className="epub-chapter">
      <div className="chapter-content" ref={hostRef} />
    </div>
  );
});
