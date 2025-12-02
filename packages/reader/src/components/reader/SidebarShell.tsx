import { X } from "lucide-react";
import type React from "react";
import {
  SidebarFeatureButton,
  type SidebarFeatureButtonProps,
} from "./SidebarFeatureButton";

export interface SidebarShellProps {
  isOpen: boolean;
  onClose: () => void;
  featureButtons: SidebarFeatureButtonProps[];
  sidebarRef?: React.RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
}

/**
 * Unified sidebar shell component used across EPUB, PDF, and Collection readers.
 * Provides consistent layout, styling, and behavior for all reader sidebars.
 */
export const SidebarShell: React.FC<SidebarShellProps> = ({
  isOpen,
  onClose,
  featureButtons,
  sidebarRef,
  children,
}) => {
  return (
    <div
      ref={sidebarRef}
      className={`absolute left-0 top-0 ${
        isOpen ? "w-80" : "w-0"
      } h-screen overflow-hidden pointer-events-auto`}
    >
      <div className="h-full flex flex-col bg-gray-50">
        {/* Sidebar header with close button and feature buttons */}
        <div className="flex-shrink-0">
          <div className="p-4">
            {/* Close button */}
            <div className="flex items-center justify-end mb-4">
              <button
                type="button"
                onClick={onClose}
                className="p-1 hover:bg-gray-200 rounded transition-colors"
                aria-label="Close sidebar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Feature buttons */}
            <div className="space-y-2">
              {featureButtons.map((button, index) => (
                <SidebarFeatureButton key={index} {...button} />
              ))}
            </div>
          </div>
        </div>

        {/* Content area (TOC or other content) - takes remaining height */}
        <div className="flex-1 min-h-0">{children}</div>
      </div>
    </div>
  );
};
