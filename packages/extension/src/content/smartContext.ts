/**
 * Smart context extraction for building ChatGPT prompts
 */

import { getSettings } from "../common/storage";
import { renderTemplate } from "../common/template";
import { toTextFragmentUrl } from "../common/textFragment";
import type { ContextPayload } from "../common/types";
import { getSelectionContext } from "./selection";

export interface BuiltContext {
  payload: ContextPayload;
  prompt: string;
}

export async function buildContextPayload(
  wordLimit?: number,
): Promise<BuiltContext | null> {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return null;
  }

  const settings = await getSettings();
  const limit = wordLimit ?? settings.wordLimit;

  try {
    const context = getSelectionContext(selection, undefined, limit);

    const pageTitle = document.title;
    const url = location.href;
    const fragmentUrl = toTextFragmentUrl(url, context.selectedText);

    const payload: ContextPayload = {
      pageTitle,
      url,
      fragmentUrl,
      selection: context.selectedText,
      beforeContext: context.beforeContext,
      afterContext: context.afterContext,
    };

    // Combine before and after context for the template
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

    const prompt = renderTemplate(templateString, {
      pageTitle: payload.pageTitle,
      url: payload.url,
      fragmentUrl: payload.fragmentUrl || "",
      selection: payload.selection,
      context: combinedContext,
    });

    return { payload, prompt };
  } catch (err) {
    console.error("Failed to build context payload:", err);
    return null;
  }
}
