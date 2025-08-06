import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { provideStorageConfig } from "./lib/providers";
import { initRootStore } from "./lib/providers_gen";
import { StoreProvider } from "./stores/RootStore";
import "./index.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}
// Initialize async stores and render
const config = provideStorageConfig();
initRootStore(config).then((rootStore) => {
  createRoot(rootElement).render(
    <StrictMode>
      <StoreProvider value={rootStore}>
        <App />
      </StoreProvider>
    </StrictMode>,
  );
});
