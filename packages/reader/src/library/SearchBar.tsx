import { X } from "lucide-react";
import type React from "react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  placeholder = "Search titles and authors...",
}) => {
  return (
    <div className="relative max-w-md mx-auto">
      <input
        className="search-bar-input w-full px-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg 
                 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white
                 transition-all duration-200"
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          aria-label="Clear search"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
