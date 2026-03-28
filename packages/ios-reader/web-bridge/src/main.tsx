import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ChapterView } from "./ChapterView.tsx";
import { initScrollTracking, initLinkInterception } from "./reader.ts";
import "./bridge.ts"; // registers window.epubBridge
import "./index.css";

// Initialize native communication
initScrollTracking();
initLinkInterception();

// Notify native that the bridge is ready
window.webkit?.messageHandlers?.ready?.postMessage({ status: "ready" });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ChapterView />
  </StrictMode>,
);
