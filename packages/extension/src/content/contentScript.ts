/**
 * Main content script for Copy with Context extension
 * Handles messages from background script and coordinates context extraction
 */

import "./contentScript.css";
import { getChromeAPI } from "../common/chromeApi";
import type { ExtensionMessage } from "../common/types";
import { extractArticleContent, initCommandMenuShortcut } from "./commandMenu";
import { showOverlay, showToast } from "./overlay";
import { buildContextPayload } from "./smartContext";

// Open ChatGPT in a new tab
function openChatGPT(): void {
  window.open("https://chat.openai.com/", "_blank");
}

// Open side panel
async function openSidePanel(): Promise<void> {
  try {
    const chromeAPI = getChromeAPI();
    await chromeAPI.runtime.sendMessage({ type: "OPEN_SIDE_PANEL" });
  } catch (err) {
    console.error("Failed to open side panel:", err);
  }
}

// Main handler for copying with context
async function copyWithContext(
  preSelectedText?: string,
  templateId?: string,
): Promise<void> {
  console.log(
    "copyWithContext called with preSelectedText:",
    preSelectedText,
    "templateId:",
    templateId,
  );

  // If we have pre-selected text from context menu but no current selection,
  // we need to build context differently
  const selection = window.getSelection();
  const hasCurrentSelection =
    selection && selection.toString().trim().length > 0;

  console.log("Current selection:", selection?.toString());
  console.log("Has current selection:", hasCurrentSelection);

  // Build context payload using current selection or fallback
  const built = await buildContextPayload();

  if (!built) {
    // If no selection context could be built, try with just the pre-selected text
    if (preSelectedText) {
      console.log("No context built, using pre-selected text only");
      const simplePayload = {
        pageTitle: document.title,
        url: location.href,
        selection: preSelectedText,
        beforeContext: "",
        afterContext: "",
        fragmentUrl: undefined,
      };

      const settings = await (await import("../common/storage")).getSettings();

      // Find the template to use
      const template = templateId
        ? settings.templates.find((t) => t.id === templateId)
        : settings.templates.find((t) => t.type === "selection");

      if (!template) {
        showToast("Template not found");
        return;
      }

      const prompt = (await import("../common/template")).renderTemplate(
        template.template,
        {
          pageTitle: simplePayload.pageTitle,
          url: simplePayload.url,
          fragmentUrl: "",
          selection: simplePayload.selection,
          context: simplePayload.selection,
        },
      );

      await copyToClipboardAndNotify(prompt, simplePayload);
      return;
    }

    showToast("No selection found. Please select some text and try again.");
    return;
  }

  // If a specific template is provided, use it
  if (templateId) {
    const settings = await (await import("../common/storage")).getSettings();
    const template = settings.templates.find((t) => t.id === templateId);

    if (!template) {
      showToast("Template not found");
      return;
    }

    const combinedContext = [
      built.payload.beforeContext,
      built.payload.selection,
      built.payload.afterContext,
    ]
      .filter(Boolean)
      .join("\n\n");

    const prompt = (await import("../common/template")).renderTemplate(
      template.template,
      {
        pageTitle: built.payload.pageTitle,
        url: built.payload.url,
        fragmentUrl: built.payload.fragmentUrl || "",
        selection: built.payload.selection,
        context: combinedContext,
      },
    );

    await copyToClipboardAndNotify(prompt, built.payload);
    return;
  }

  await copyToClipboardAndNotify(built.prompt, built.payload);
}

async function copyToClipboardAndNotify(
  prompt: string,
  payload: {
    url: string;
    pageTitle: string;
    fragmentUrl?: string;
    selection: string;
    beforeContext: string;
    afterContext: string;
  },
): Promise<void> {
  try {
    console.log("Copying to clipboard:", prompt.substring(0, 100) + "...");

    // Copy to clipboard
    await navigator.clipboard.writeText(prompt);
    console.log("Clipboard write successful");

    // Save to session storage for side panel to retrieve
    // Include the prompt for consistency between copy and side panel
    const chromeAPI = getChromeAPI();
    await chromeAPI.storage.session.set({
      lastCapture: {
        ...payload,
        prompt, // Store the actual prompt that was copied
      },
    });
    console.log("Capture saved to session storage");

    // Show toast with actions
    showToast("Copied ChatGPT template!", [
      {
        label: "Open ChatGPT",
        onClick: openChatGPT,
      },
      {
        label: "Side Panel",
        onClick: openSidePanel,
        secondary: true,
      },
    ]);
  } catch (err) {
    console.error("Failed to copy with context:", err);
    showToast(
      `Failed to copy: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

// Copy entire article content using Readability
async function copyArticleContent(templateId?: string): Promise<void> {
  console.log("copyArticleContent called with templateId:", templateId);

  const article = extractArticleContent();

  if (!article) {
    showToast(
      "Could not extract article content. This page may not have a main article.",
    );
    return;
  }

  const settings = await (await import("../common/storage")).getSettings();

  // Find the template to use
  const template = templateId
    ? settings.templates.find((t) => t.id === templateId)
    : settings.templates.find((t) => t.type === "article");

  if (!template) {
    showToast("Template not found");
    return;
  }

  // Create a payload with the article content
  const payload = {
    pageTitle: article.title || document.title,
    url: location.href,
    fragmentUrl: undefined,
    selection: article.textContent.trim(),
    beforeContext: "",
    afterContext: "",
  };

  // Render template with article content
  const prompt = (await import("../common/template")).renderTemplate(
    template.template,
    {
      pageTitle: payload.pageTitle,
      url: payload.url,
      fragmentUrl: "",
      selection: payload.selection,
      context: payload.selection,
    },
  );

  await copyToClipboardAndNotify(prompt, payload);
}

// Handle messages from background script
getChromeAPI().runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: any) => void,
  ) => {
    console.log("Content script received message:", message);

    if (message.type === "COPY_WITH_CONTEXT") {
      copyWithContext(message.selectionText)
        .then(() => {
          console.log("Copy with context completed");
          sendResponse({ success: true });
        })
        .catch((err) => {
          console.error("Copy with context failed:", err);
          sendResponse({ success: false, error: String(err) });
        });
      return true; // Keep channel open for async response
    }

    if (message.type === "SHOW_OVERLAY") {
      showOverlay(message.outline, message.captureId);
      sendResponse({ success: true });
      return false;
    }

    return false;
  },
);

// Initialize command menu keyboard shortcut (cmd-k / ctrl-k)
initCommandMenuShortcut(async (templateId, type) => {
  if (type === "selection") {
    await copyWithContext(undefined, templateId);
  } else if (type === "article") {
    await copyArticleContent(templateId);
  }
});

// Log when content script loads
console.log("Copy with Context content script loaded");
