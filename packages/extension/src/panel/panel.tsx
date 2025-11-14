/**
 * Side Panel UI for Copy with Context extension
 */

import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { getSettings } from "../common/storage";
import { renderTemplate } from "../common/template";
import type { ContextPayload } from "../common/types";
import "./panel.css";

interface CaptureState {
  payload: ContextPayload | null;
  prompt: string;
}

function Panel() {
  const [capture, setCapture] = useState<CaptureState | null>(null);
  const [outline, setOutline] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadLastCapture();

    // Listen for storage changes
    // Note: Use chrome.storage.onChanged, not chrome.storage.session.onChanged
    const listener = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) => {
      if (areaName === "session" && changes.lastCapture) {
        loadLastCapture();
      }
    };
    chrome.storage.onChanged.addListener(listener);

    return () => {
      chrome.storage.onChanged.removeListener(listener);
    };
  }, []);

  async function loadLastCapture() {
    try {
      const result = await chrome.storage.session.get("lastCapture");
      if (result.lastCapture) {
        const payload = result.lastCapture as ContextPayload;

        // Use the stored prompt if available (for consistency with what was copied)
        // Otherwise fall back to regenerating it
        let prompt = payload.prompt;

        if (!prompt) {
          const settings = await getSettings();
          const combinedContext = [
            payload.beforeContext,
            payload.selection,
            payload.afterContext,
          ]
            .filter(Boolean)
            .join("\n\n");

          // Use the first selection template or fall back to legacy promptTemplate
          const template =
            settings.templates.find((t) => t.type === "selection") ||
            settings.templates[0];
          const templateString = template
            ? template.template
            : settings.promptTemplate || "";

          prompt = renderTemplate(templateString, {
            pageTitle: payload.pageTitle,
            url: payload.url,
            fragmentUrl: payload.fragmentUrl || "",
            selection: payload.selection,
            context: combinedContext,
          });
        }

        setCapture({ payload, prompt });
      }
    } catch (err) {
      console.error("Failed to load last capture:", err);
    }
  }

  async function copyPrompt() {
    if (!capture) return;
    await navigator.clipboard.writeText(capture.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function showOutlineOverlay() {
    if (!outline.trim()) return;

    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tab?.id) {
        await chrome.tabs.sendMessage(tab.id, {
          type: "SHOW_OVERLAY",
          outline: outline.trim(),
        });
      }
    } catch (err) {
      console.error("Failed to show overlay:", err);
    }
  }

  if (!capture || !capture.payload) {
    return (
      <div className="panel">
        <div className="panel-empty">
          <p>No capture yet.</p>
          <p className="panel-empty-hint">
            Right-click on selected text and choose "Copy with context" to get
            started.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-section">
        <h2 className="panel-title">Captured Context</h2>
        <div className="panel-meta">
          <div className="panel-meta-item">
            <strong>Page:</strong> {capture.payload.pageTitle}
          </div>
          <div className="panel-meta-item">
            <strong>URL:</strong>{" "}
            <a
              href={capture.payload.fragmentUrl || capture.payload.url}
              target="_blank"
              rel="noopener noreferrer"
              className="panel-link"
            >
              {capture.payload.url}
            </a>
          </div>
        </div>

        <div className="panel-field">
          <label className="panel-label">Selection:</label>
          <div className="panel-readonly">{capture.payload.selection}</div>
        </div>

        <div className="panel-field">
          <label className="panel-label">ChatGPT Prompt:</label>
          <textarea
            className="panel-textarea"
            value={capture.prompt}
            readOnly
            rows={10}
          />
        </div>

        <button className="panel-button" onClick={copyPrompt}>
          {copied ? "Copied!" : "Copy Prompt"}
        </button>
      </div>

      <div className="panel-section">
        <h2 className="panel-title">Paste Outline</h2>
        <p className="panel-hint">
          Paste the outline from ChatGPT here and click "Show Overlay" to
          display it on the page.
        </p>

        <textarea
          className="panel-textarea"
          placeholder="Paste outline from ChatGPT..."
          value={outline}
          onChange={(e) => setOutline(e.target.value)}
          rows={8}
        />

        <button
          className="panel-button panel-button-primary"
          onClick={showOutlineOverlay}
          disabled={!outline.trim()}
        >
          Show Overlay
        </button>
      </div>
    </div>
  );
}

// Mount the React app
const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<Panel />);
}
