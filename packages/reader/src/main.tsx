import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { RootStore, StoreProvider } from "./stores/RootStore";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}
// Create root store instance
const rootStore = new RootStore();

createRoot(rootElement).render(
  <StrictMode>
    <StoreProvider value={rootStore}>
      <App />
    </StoreProvider>
  </StrictMode>,
);
