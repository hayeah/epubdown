import type React from "react";
import type { Command } from "./types";

interface CommandRowProps {
  command: Command;
  isSelected: boolean;
  isHovered: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  query: string;
}

export const CommandRow: React.FC<CommandRowProps> = ({
  command,
  isSelected,
  isHovered,
  onClick,
  onMouseEnter,
  onMouseLeave,
  query,
}) => {
  // Highlight matching text
  const highlightText = (text: string) => {
    if (!query) return text;

    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const index = lowerText.indexOf(lowerQuery);

    if (index === -1) return text;

    return (
      <>
        {text.slice(0, index)}
        <span
          className={
            isSelected ? "font-semibold underline" : "text-blue-600 font-medium"
          }
        >
          {text.slice(index, index + query.length)}
        </span>
        {text.slice(index + query.length)}
      </>
    );
  };

  return (
    <button
      type="button"
      className={`
        w-full flex items-center gap-3 px-3 py-1.5 text-left text-sm
        transition-colors duration-75
        ${isSelected ? "bg-blue-100 text-blue-900" : ""}
        ${!isSelected && isHovered ? "bg-gray-50" : ""}
      `}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {command.icon && (
        <span
          className={`flex-shrink-0 w-4 h-4 ${isSelected ? "text-blue-700" : "text-gray-500"}`}
        >
          {command.icon}
        </span>
      )}

      <span className="flex-1 truncate">{highlightText(command.label)}</span>

      {command.category && (
        <span
          className={`text-xs ${
            isSelected
              ? "text-blue-600 opacity-100"
              : isHovered
                ? "text-gray-400 opacity-100"
                : "opacity-0"
          }`}
        >
          {command.category}
        </span>
      )}

      {command.shortcut && (
        <span
          className={`text-xs font-mono ${
            isSelected
              ? "text-blue-600 opacity-100"
              : isHovered
                ? "text-gray-400 opacity-100"
                : "opacity-0"
          }`}
        >
          {command.shortcut}
        </span>
      )}
    </button>
  );
};
