import type { EventSystem } from "../events/EventSystem";

export type AppLayers =
  | "global"
  | "view:library"
  | "view:reader"
  | "overlay:palette"
  | "overlay:contextMenu"
  | "overlay:selectionPopover"
  | "overlay:sidebar";

export type AppCtx = {
  route:
    | "/"
    | `/book/${number}`
    | `/book/${number}/${number}`
    | "/prototype/command-palette";
  mode: "library" | "reader" | "prototype";
  paletteOpen: boolean;
  sidebarOpen: boolean;
  hasSelection: boolean;
};

// Type alias for DI system (now without generics)
export type AppEventSystem = EventSystem;
