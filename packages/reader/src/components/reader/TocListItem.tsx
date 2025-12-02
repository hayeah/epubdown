import type React from "react";

export interface TocListItemProps {
  label: string;
  isActive: boolean;
  indent?: number;
  icon?: React.ReactNode;
  rightContent?: React.ReactNode;
  onClick: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  href?: string;
  children?: React.ReactNode;
}

/**
 * Unified list item component for table of contents.
 * Provides consistent active/hover styling across all reader types.
 */
export const TocListItem: React.FC<TocListItemProps> = ({
  label,
  isActive,
  indent = 0,
  icon,
  rightContent,
  onClick,
  href = "#",
  children,
}) => {
  return (
    <li style={{ paddingLeft: `${indent}rem` }}>
      <a
        href={href}
        onClick={onClick}
        className={`flex items-center gap-2 py-1 px-2 rounded hover:bg-gray-100 transition-colors ${
          isActive ? "bg-blue-50 text-blue-600 font-medium" : "text-gray-700"
        }`}
      >
        {icon}
        <span className="truncate flex-1">{label}</span>
        {rightContent}
      </a>
      {children}
    </li>
  );
};
