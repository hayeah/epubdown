/**
 * Storage utilities for chrome.storage API
 */

import { getChromeAPI } from "./chromeApi";
import type { Capture, Settings } from "./types";
import { DEFAULT_SETTINGS, DEFAULT_TEMPLATES } from "./types";

export async function getSettings(): Promise<Settings> {
  const chromeAPI = getChromeAPI();
  const result = await chromeAPI.storage.local.get("settings");
  const stored = result.settings || {};

  // Migration: if old promptTemplate exists but no templates array, create one
  if (stored.promptTemplate && !stored.templates) {
    stored.templates = [
      {
        id: "selection-outline",
        name: "Create outline from selection",
        description:
          "Generate a concise outline from selected text with context",
        type: "selection",
        template: stored.promptTemplate,
      },
      ...DEFAULT_TEMPLATES.filter((t) => t.id !== "selection-outline"),
    ];
  }

  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function saveSettings(settings: Partial<Settings>): Promise<void> {
  const chromeAPI = getChromeAPI();
  const current = await getSettings();
  await chromeAPI.storage.local.set({
    settings: { ...current, ...settings },
  });
}

export async function saveCapture(capture: Capture): Promise<void> {
  const chromeAPI = getChromeAPI();
  await chromeAPI.storage.session.set({
    [`capture_${capture.tabId}`]: capture,
  });
}

export async function getCapture(tabId: number): Promise<Capture | null> {
  const chromeAPI = getChromeAPI();
  const result = await chromeAPI.storage.session.get(`capture_${tabId}`);
  return result[`capture_${tabId}`] || null;
}

export async function clearCapture(tabId: number): Promise<void> {
  const chromeAPI = getChromeAPI();
  await chromeAPI.storage.session.remove(`capture_${tabId}`);
}
