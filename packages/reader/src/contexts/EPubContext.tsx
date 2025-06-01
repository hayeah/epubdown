import type { EPubResolverContext as EPubResolverContextType } from "@epubdown/core";
import React from "react";

// React Context (to be used in your React components)
export const EPubResolverContext =
  React.createContext<EPubResolverContextType | null>(null);

// Hook for accessing the resolver in components
export function useEPubResolver(): EPubResolverContextType {
  const context = React.useContext(EPubResolverContext);
  if (!context) {
    throw new Error("useEPubResolver must be used within EPubResolverProvider");
  }
  return context;
}
