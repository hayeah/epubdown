import type { LucideIcon } from "lucide-react";
import type React from "react";

export interface SidebarFeatureButtonProps {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  shortcut?: string;
  rightContent?: React.ReactNode;
}

export const SidebarFeatureButton: React.FC<SidebarFeatureButtonProps> = ({
  icon: Icon,
  label,
  onClick,
  shortcut,
  rightContent,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-200 rounded-lg transition-colors"
    >
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5 text-gray-600" />
        <span>{label}</span>
      </div>
      {rightContent ||
        (shortcut && <span className="text-xs text-gray-500">{shortcut}</span>)}
    </button>
  );
};
