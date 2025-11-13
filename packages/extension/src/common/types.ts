/**
 * Core types for the Copy with Context extension
 */

export interface Capture {
  id: string;
  tabId: number;
  url: string;
  pageTitle: string;
  fragmentUrl?: string;
  selection: string;
  context: string;
  createdAt: number;
}

export interface ContextPayload {
  pageTitle: string;
  url: string;
  fragmentUrl?: string;
  selection: string;
  beforeContext: string;
  afterContext: string;
  prompt?: string; // Store the actual prompt for consistency
}

export interface MessageCopyWithContext {
  type: "COPY_WITH_CONTEXT";
  selectionText?: string; // Selection text from context menu
}

export interface MessageShowOverlay {
  type: "SHOW_OVERLAY";
  outline: string;
  captureId?: string;
}

export interface MessageOpenSidePanel {
  type: "OPEN_SIDE_PANEL";
}

export type ExtensionMessage =
  | MessageCopyWithContext
  | MessageShowOverlay
  | MessageOpenSidePanel;

export type TemplateType = "selection" | "article";

export interface Template {
  id: string;
  name: string;
  description: string;
  type: TemplateType;
  template: string;
}

export interface Settings {
  wordLimit: number;
  openChatGPTAfterCopy: boolean;
  templates: Template[];
  // Legacy field for backward compatibility
  promptTemplate?: string;
}

export const DEFAULT_TEMPLATES: Template[] = [
  {
    id: "selection-outline",
    name: "Create outline from selection",
    description: "Generate a concise outline from selected text with context",
    type: "selection",
    template: `You are a writing assistant. Given an excerpt and its immediate context from a web page, produce a concise outline (3–8 bullets) of the section/chapter likely covered by this excerpt.

Page title: {{pageTitle}}
URL: {{url}}
Deep link (if available): {{fragmentUrl}}

Selection:
"""
{{selection}}
"""

Surrounding context:
"""
{{context}}
"""

Return only the outline bullets plus a one-line verdict: "Worth reading now?" = Yes/No + a 10-word reason.`,
  },
  {
    id: "selection-summary",
    name: "Summarize selection",
    description: "Create a brief summary of the selected text",
    type: "selection",
    template: `Summarize the following text excerpt in 2-3 sentences.

Page title: {{pageTitle}}
URL: {{url}}

Selection:
"""
{{selection}}
"""

Context:
"""
{{context}}
"""`,
  },
  {
    id: "article-outline",
    name: "Create outline from article",
    description: "Generate a comprehensive outline from the full article",
    type: "article",
    template: `You are a writing assistant. Create a comprehensive outline (5-12 bullets) of the main points in this article.

Page title: {{pageTitle}}
URL: {{url}}

Article content:
"""
{{selection}}
"""

Return the outline plus a one-line verdict: "Worth reading?" = Yes/No + a 10-word reason.`,
  },
  {
    id: "article-summary",
    name: "Summarize article",
    description: "Create a detailed summary of the full article",
    type: "article",
    template: `Summarize this article in 3-5 paragraphs, covering the main points and key takeaways.

Page title: {{pageTitle}}
URL: {{url}}

Article content:
"""
{{selection}}
"""`,
  },
];

export const DEFAULT_SETTINGS: Settings = {
  wordLimit: 400,
  openChatGPTAfterCopy: false,
  templates: DEFAULT_TEMPLATES,
};
