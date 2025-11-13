/**
 * Popup UI for Copy with Context extension
 */

import React from "react";
import { createRoot } from "react-dom/client";
import "./popup.css";

function Popup() {
  async function openSidePanel() {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tab?.id) {
        await chrome.sidePanel.open({ tabId: tab.id });
        window.close();
      }
    } catch (err) {
      console.error("Failed to open side panel:", err);
    }
  }

  return (
    <div className="popup">
      <div className="popup-header">
        <h1 className="popup-title">Copy with Context</h1>
        <p className="popup-subtitle">
          Extract text with smart context for ChatGPT
        </p>
      </div>

      <div className="popup-content">
        <div className="popup-instruction">
          <div className="popup-step">
            <span className="popup-step-number">1</span>
            <div>
              <strong>Select text</strong> on any webpage
            </div>
          </div>
          <div className="popup-step">
            <span className="popup-step-number">2</span>
            <div>
              <strong>Right-click</strong> and choose "Copy with context"
            </div>
          </div>
          <div className="popup-step">
            <span className="popup-step-number">3</span>
            <div>
              <strong>Paste</strong> into ChatGPT to get an outline
            </div>
          </div>
          <div className="popup-step">
            <span className="popup-step-number">4</span>
            <div>
              <strong>Open side panel</strong> to paste outline back
            </div>
          </div>
        </div>

        <button className="popup-button" onClick={openSidePanel}>
          Open Side Panel
        </button>
      </div>

      <div className="popup-footer">
        <a
          href="https://github.com"
          target="_blank"
          rel="noopener noreferrer"
          className="popup-link"
        >
          Documentation
        </a>
      </div>
    </div>
  );
}

// Mount the React app
const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<Popup />);
}
