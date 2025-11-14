/**
 * Overlay UI management using Shadow DOM
 */

let root: ShadowRoot | null = null;
let host: HTMLElement | null = null;

export function ensureOverlayRoot(): ShadowRoot {
  if (root) return root;

  host = document.createElement("cwc-overlay");
  Object.assign(host.style, {
    all: "initial",
    position: "fixed",
    right: "16px",
    bottom: "16px",
    zIndex: "2147483647",
    fontFamily: "system-ui, -apple-system, sans-serif",
  });

  document.documentElement.appendChild(host);
  root = host.attachShadow({ mode: "open" });

  const container = document.createElement("div");
  container.id = "cwc-container";
  root.appendChild(container);

  // Add minimal styles inside shadow DOM
  const style = document.createElement("style");
  style.textContent = `
    #cwc-container {
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      line-height: 1.5;
    }

    .cwc-toast {
      background: #1a1a1a;
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      display: flex;
      align-items: center;
      gap: 12px;
      max-width: 400px;
    }

    .cwc-toast-text {
      flex: 1;
    }

    .cwc-toast-actions {
      display: flex;
      gap: 8px;
    }

    .cwc-toast-button {
      background: #3b82f6;
      color: white;
      border: none;
      padding: 6px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      white-space: nowrap;
    }

    .cwc-toast-button:hover {
      background: #2563eb;
    }

    .cwc-toast-button-secondary {
      background: #4b5563;
    }

    .cwc-toast-button-secondary:hover {
      background: #374151;
    }

    .cwc-card {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
      max-width: 500px;
      max-height: 600px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .cwc-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px;
      border-bottom: 1px solid #e5e7eb;
      background: #f9fafb;
    }

    .cwc-card-title {
      font-weight: 600;
      font-size: 16px;
      color: #1a1a1a;
      margin: 0;
    }

    .cwc-card-close {
      background: transparent;
      border: none;
      font-size: 24px;
      color: #6b7280;
      cursor: pointer;
      padding: 0;
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
    }

    .cwc-card-close:hover {
      background: #e5e7eb;
      color: #1a1a1a;
    }

    .cwc-card-body {
      padding: 16px;
      overflow-y: auto;
      flex: 1;
    }

    .cwc-card-body pre {
      margin: 0;
      white-space: pre-wrap;
      word-wrap: break-word;
      font-family: ui-monospace, monospace;
      font-size: 13px;
      color: #374151;
      line-height: 1.6;
    }

    .cwc-card-actions {
      padding: 12px 16px;
      border-top: 1px solid #e5e7eb;
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }

    .cwc-card-button {
      background: #3b82f6;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
    }

    .cwc-card-button:hover {
      background: #2563eb;
    }
  `;
  root.appendChild(style);

  return root;
}

export function removeOverlay(): void {
  if (host) {
    host.remove();
    host = null;
    root = null;
  }
}

export function showToast(
  text: string,
  actions?: Array<{ label: string; onClick: () => void; secondary?: boolean }>,
): void {
  const r = ensureOverlayRoot();
  const container = r.getElementById("cwc-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = "cwc-toast";

  const textEl = document.createElement("div");
  textEl.className = "cwc-toast-text";
  textEl.textContent = text;
  toast.appendChild(textEl);

  if (actions && actions.length > 0) {
    const actionsEl = document.createElement("div");
    actionsEl.className = "cwc-toast-actions";

    for (const action of actions) {
      const button = document.createElement("button");
      button.className = action.secondary
        ? "cwc-toast-button cwc-toast-button-secondary"
        : "cwc-toast-button";
      button.textContent = action.label;
      button.addEventListener("click", () => {
        action.onClick();
        removeOverlay();
      });
      actionsEl.appendChild(button);
    }

    toast.appendChild(actionsEl);
  }

  container.innerHTML = "";
  container.appendChild(toast);

  // Auto-hide after 10 seconds if no actions
  if (!actions || actions.length === 0) {
    setTimeout(() => {
      if (container.firstChild === toast) {
        removeOverlay();
      }
    }, 10000);
  }
}

export function showOverlay(outline: string, captureId?: string): void {
  const r = ensureOverlayRoot();
  const container = r.getElementById("cwc-container");
  if (!container) return;

  const card = document.createElement("div");
  card.className = "cwc-card";

  // Header
  const header = document.createElement("div");
  header.className = "cwc-card-header";

  const title = document.createElement("h3");
  title.className = "cwc-card-title";
  title.textContent = "Outline";
  header.appendChild(title);

  const closeBtn = document.createElement("button");
  closeBtn.className = "cwc-card-close";
  closeBtn.innerHTML = "×";
  closeBtn.addEventListener("click", () => removeOverlay());
  header.appendChild(closeBtn);

  card.appendChild(header);

  // Body
  const body = document.createElement("div");
  body.className = "cwc-card-body";

  const pre = document.createElement("pre");
  pre.textContent = outline.trim();
  body.appendChild(pre);

  card.appendChild(body);

  // Actions
  const actions = document.createElement("div");
  actions.className = "cwc-card-actions";

  const copyBtn = document.createElement("button");
  copyBtn.className = "cwc-card-button";
  copyBtn.textContent = "Copy outline";
  copyBtn.addEventListener("click", async () => {
    await navigator.clipboard.writeText(outline);
    copyBtn.textContent = "Copied!";
    setTimeout(() => {
      copyBtn.textContent = "Copy outline";
    }, 2000);
  });
  actions.appendChild(copyBtn);

  card.appendChild(actions);

  container.innerHTML = "";
  container.appendChild(card);
}
