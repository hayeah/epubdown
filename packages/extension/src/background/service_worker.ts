/**
 * Background service worker for the Copy with Context extension
 * Handles context menu creation, message routing, and side panel management
 */

import type { MessageCopyWithContext } from "../common/types";

// Initialize context menu on installation
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "copy-with-context",
    title: "Copy with context",
    contexts: ["selection"], // Only show when text is selected
  });

  // Enable side panel globally
  chrome.sidePanel.setOptions({ enabled: true }).catch((err) => {
    console.error("Failed to enable side panel:", err);
  });

  // CRITICAL: Allow content scripts to access chrome.storage.session
  // By default, session storage is only accessible from trusted contexts (service worker, extension pages)
  // This call enables access from content scripts (untrusted contexts)
  chrome.storage.session
    .setAccessLevel({
      accessLevel: "TRUSTED_AND_UNTRUSTED_CONTEXTS",
    })
    .then(() => {
      console.log("Session storage access level set for content scripts");
    })
    .catch((err) => {
      console.error("Failed to set session storage access level:", err);
    });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "copy-with-context" || !tab?.id) return;

  console.log("Context menu clicked, selection:", info.selectionText);

  try {
    // Send message to content script (already injected via manifest)
    // Include the selection text from the context menu
    const message: MessageCopyWithContext = {
      type: "COPY_WITH_CONTEXT",
      selectionText: info.selectionText,
    };

    await chrome.tabs.sendMessage(tab.id, message);
    console.log("Message sent to content script");
  } catch (err) {
    console.error("Failed to send message to content script:", err);
    // If content script not ready, try injecting and retrying
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content/contentScript.js"],
      });
      // Retry sending message
      const message: MessageCopyWithContext = {
        type: "COPY_WITH_CONTEXT",
        selectionText: info.selectionText,
      };
      await chrome.tabs.sendMessage(tab.id, message);
    } catch (retryErr) {
      console.error("Failed to inject and retry:", retryErr);
    }
  }
});

// Handle messages from content scripts and side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "OPEN_SIDE_PANEL" && sender.tab?.id) {
    chrome.sidePanel
      .open({ tabId: sender.tab.id })
      .then(() => sendResponse({ success: true }))
      .catch((err) => {
        console.error("Failed to open side panel:", err);
        sendResponse({ success: false, error: String(err) });
      });
    return true; // Keep message channel open for async response
  }

  return false;
});
