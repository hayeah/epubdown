import { observer } from "mobx-react-lite";
import type React from "react";
import { Link } from "wouter";
import { useReaderStore } from "../stores/RootStore";
import { resolveTocHref } from "../utils/pathUtils";

interface InternalLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
}

export const InternalLink = observer(
  ({ href, children, className }: InternalLinkProps) => {
    const readerStore = useReaderStore();
    const tocBase = readerStore.tocBase;
    const currentBookId = readerStore.currentBookId;

    // Check if it's an external link
    if (
      href.startsWith("http://") ||
      href.startsWith("https://") ||
      href.startsWith("mailto:")
    ) {
      return (
        <a
          href={href}
          className={className}
          target="_blank"
          rel="noopener noreferrer"
        >
          {children}
        </a>
      );
    }

    // Handle fragment-only links (same chapter)
    if (href.startsWith("#")) {
      const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault();
        const elementId = href.substring(1);
        const element = document.getElementById(elementId);
        if (element) {
          element.scrollIntoView({ behavior: "smooth" });
        }
      };

      return (
        <a
          href={href}
          className={`text-gray-600 no-underline border-b border-dotted border-gray-500 cursor-pointer hover:text-gray-900 hover:border-gray-700 ${className || ""}`}
          onClick={handleClick}
        >
          {children}
        </a>
      );
    }

    // For chapter navigation, compute the target URL
    const resolvedHref = resolveTocHref(tocBase, href);
    const chapterIndex = readerStore.findChapterIndexByHref(resolvedHref);

    // Compute the final href
    let finalHref = href;
    let handleClick: (() => void) | undefined;

    if (chapterIndex !== -1 && currentBookId) {
      const [chapterPath, fragment] = href.split("#");
      const fragmentPart = fragment ? `#${fragment}` : "";
      finalHref = `/book/${currentBookId}/${chapterIndex}${fragmentPart}`;

      handleClick = () => {
        readerStore.setSidebarOpen(false); // Close sidebar on mobile after selection

        // If there's a fragment, scroll to it after navigation
        if (fragment) {
          setTimeout(() => {
            const element = document.getElementById(fragment);
            if (element) {
              element.scrollIntoView({ behavior: "smooth" });
            }
          }, 100);
        }
      };
    }

    return (
      <Link
        href={finalHref}
        className={`text-gray-200 no-underline border-b border-dotted border-gray-200 cursor-pointer hover:text-gray-900 hover:border-gray-700 ${className || ""}`}
        onClick={handleClick}
      >
        {children}
      </Link>
    );
  },
);
