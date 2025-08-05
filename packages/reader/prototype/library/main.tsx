import React from "react";
import ReactDOM from "react-dom/client";
import "../../src/index.css";
import LibraryPrototype from "./LibraryPrototype";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <LibraryPrototype />
  </React.StrictMode>,
);
