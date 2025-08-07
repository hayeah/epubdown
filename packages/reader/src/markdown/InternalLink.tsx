import { observer } from "mobx-react-lite";
import type React from "react";
import { Link } from "wouter";
import { useReaderStore } from "../stores/RootStore";

interface InternalLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
}

export const InternalLink = observer(
  ({ href, children, className }: InternalLinkProps) => {
    const readerStore = useReaderStore();

    // Check if it's an external link or fragment-only
    if (
      href.startsWith("http://") ||
      href.startsWith("https://") ||
      href.startsWith("mailto:") ||
      href.startsWith("#")
    ) {
      return (
        <a
          href={href}
          className={className}
          target={href.startsWith("#") ? undefined : "_blank"}
          rel={href.startsWith("#") ? undefined : "noopener noreferrer"}
        >
          {children}
        </a>
      );
    }

    // For internal chapter links - href is now an absolute path
    const finalHref = readerStore.rootedHrefToBookHref(href);

    if (!finalHref) {
      // Chapter not found, render as plain text or disabled link
      return <span className={className}>{children}</span>;
    }

    return (
      <Link
        href={finalHref}
        className={`text-gray-200 no-underline border-b border-dotted border-gray-200 cursor-pointer hover:text-gray-900 hover:border-gray-700 ${className || ""}`}
      >
        {children}
      </Link>
    );
  },
);
