import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { RootStore, StoreProvider } from "./stores/RootStore";
import "./index.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}
// Initialize async stores and render
RootStore.create().then((rootStore) => {
  createRoot(rootElement).render(
    <StrictMode>
      <StoreProvider value={rootStore}>
        <App />
      </StoreProvider>
    </StrictMode>,
  );
});
