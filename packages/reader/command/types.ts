import type React from "react";

export type CommandScope = "global" | "context";
export type CommandMode = "palette" | "menu" | "slide" | "selection";

export interface Command {
  id: string;
  label: string;
  shortcut?: string;
  icon?: React.ReactNode;
  category?: string;
  keywords?: string[];
  action: () => void;
  lastUsed?: number;
  popularity?: number; // 0..1
  scope?: CommandScope;
}

export interface OpenMenuOpts {
  anchorElement?: HTMLElement | null;
  position?: { x: number; y: number } | null;
}

export interface OpenSelectionOpts {
  range: Range;
  gap?: number;
  stick?: "auto" | "above" | "below";
}
