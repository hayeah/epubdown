/**
 * Command menu UI and keyboard shortcut handling
 * Shows a centered overlay with available commands when user presses cmd-k/ctrl-k
 */

import { Readability } from "@mozilla/readability";

let menuRoot: ShadowRoot | null = null;
let menuHost: HTMLElement | null = null;

interface CommandOption {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  shortcut?: string;
  category: "selection" | "article";
  action: () => void | Promise<void>;
}

function ensureMenuRoot(): ShadowRoot {
  if (menuRoot) return menuRoot;

  menuHost = document.createElement("cwc-command-menu");
  Object.assign(menuHost.style, {
    all: "initial",
    position: "fixed",
    top: "0",
    left: "0",
    right: "0",
    bottom: "0",
    zIndex: "2147483647",
    pointerEvents: "none",
  });

  document.documentElement.appendChild(menuHost);
  menuRoot = menuHost.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = `
    * {
      box-sizing: border-box;
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    @keyframes scaleIn {
      from {
        opacity: 0;
        transform: scale(0.96) translateY(-16px);
      }
      to {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }

    @keyframes shimmer {
      0% {
        background-position: -468px 0;
      }
      100% {
        background-position: 468px 0;
      }
    }

    .backdrop {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(8px);
      animation: fadeIn 0.15s ease-out;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding-top: 120px;
      pointer-events: auto;
    }

    .command-menu {
      background: linear-gradient(to bottom, #2a2d2e 0%, #252526 100%);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      box-shadow:
        0 0 0 1px rgba(0, 0, 0, 0.05),
        0 24px 48px rgba(0, 0, 0, 0.7),
        0 8px 16px rgba(0, 0, 0, 0.4);
      width: 640px;
      max-width: 90vw;
      max-height: 480px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      animation: scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      pointer-events: auto;
    }

    .search-container {
      position: relative;
      padding: 4px;
    }

    .search-icon {
      position: absolute;
      left: 20px;
      top: 50%;
      transform: translateY(-50%);
      width: 18px;
      height: 18px;
      color: #6c6c6c;
      pointer-events: none;
    }

    .search-input {
      padding: 16px 20px 16px 48px;
      border: none;
      font-size: 15px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      font-weight: 400;
      outline: none;
      background: rgba(255, 255, 255, 0.05);
      color: #e4e4e4;
      border-radius: 8px;
      width: 100%;
      transition: background 0.15s ease;
    }

    .search-input:focus {
      background: rgba(255, 255, 255, 0.08);
    }

    .search-input::placeholder {
      color: #6c6c6c;
      font-weight: 400;
    }

    .commands-container {
      display: flex;
      flex-direction: column;
      overflow-y: auto;
      max-height: 400px;
      padding: 8px;
    }

    .category-header {
      padding: 8px 16px 4px 16px;
      font-size: 11px;
      font-weight: 600;
      color: #858585;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 4px;
    }

    .category-header:first-child {
      margin-top: 0;
    }

    .command-item {
      padding: 10px 12px;
      cursor: pointer;
      border: none;
      background: transparent;
      width: 100%;
      text-align: left;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      transition: all 0.12s cubic-bezier(0.4, 0, 0.2, 1);
      display: flex;
      align-items: center;
      gap: 12px;
      border-radius: 6px;
      margin: 1px 0;
      position: relative;
      overflow: hidden;
    }

    .command-item::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 3px;
      background: linear-gradient(to bottom, #4c9aff, #0052cc);
      opacity: 0;
      transition: opacity 0.12s ease;
    }

    .command-item:hover {
      background: rgba(255, 255, 255, 0.06);
      transform: translateX(2px);
    }

    .command-item.selected {
      background: linear-gradient(90deg, rgba(76, 154, 255, 0.16) 0%, rgba(76, 154, 255, 0.08) 100%);
      box-shadow: inset 0 0 0 1px rgba(76, 154, 255, 0.3);
    }

    .command-item.selected::before {
      opacity: 1;
    }

    .command-item-icon {
      width: 32px;
      height: 32px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      background: rgba(255, 255, 255, 0.06);
      border-radius: 6px;
      transition: all 0.12s ease;
    }

    .command-item:hover .command-item-icon,
    .command-item.selected .command-item-icon {
      background: rgba(76, 154, 255, 0.15);
      transform: scale(1.05);
    }

    .command-item-content {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .command-item-label {
      font-size: 14px;
      font-weight: 500;
      color: #e4e4e4;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      transition: color 0.12s ease;
    }

    .command-item.selected .command-item-label {
      color: #ffffff;
    }

    .command-item-description {
      font-size: 12px;
      color: #9a9a9a;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      line-height: 1.3;
    }

    .command-item-shortcut {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      gap: 4px;
      margin-left: 8px;
    }

    .shortcut-key {
      padding: 3px 6px;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      color: #b0b0b0;
      font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
      transition: all 0.12s ease;
    }

    .command-item.selected .shortcut-key {
      background: rgba(76, 154, 255, 0.2);
      border-color: rgba(76, 154, 255, 0.3);
      color: #ffffff;
    }

    .no-results {
      padding: 48px 20px;
      text-align: center;
      color: #6c6c6c;
      font-size: 14px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }

    .no-results-icon {
      font-size: 32px;
      opacity: 0.5;
    }

    .footer {
      padding: 12px 16px;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11px;
      color: #6c6c6c;
      background: rgba(0, 0, 0, 0.2);
    }

    .footer-shortcuts {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .footer-shortcut {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .footer-key {
      padding: 2px 5px;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 3px;
      font-size: 10px;
      font-weight: 600;
      color: #858585;
      font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
    }

    .highlight {
      background: rgba(255, 200, 0, 0.3);
      color: #ffd700;
      font-weight: 600;
      padding: 0 2px;
      border-radius: 2px;
    }

    /* Custom scrollbar */
    .commands-container::-webkit-scrollbar {
      width: 8px;
    }

    .commands-container::-webkit-scrollbar-track {
      background: transparent;
    }

    .commands-container::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.15);
      border-radius: 4px;
      border: 2px solid transparent;
      background-clip: padding-box;
    }

    .commands-container::-webkit-scrollbar-thumb:hover {
      background: rgba(255, 255, 255, 0.25);
      background-clip: padding-box;
    }
  `;
  menuRoot.appendChild(style);

  return menuRoot;
}

export function removeCommandMenu(): void {
  if (menuHost) {
    menuHost.remove();
    menuHost = null;
    menuRoot = null;
  }
}

function highlightText(text: string, query: string): string {
  if (!query) return text;
  const regex = new RegExp(
    `(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
    "gi",
  );
  return text.replace(regex, '<span class="highlight">$1</span>');
}

export function showCommandMenu(options: CommandOption[]): void {
  const root = ensureMenuRoot();

  // Create backdrop for click-outside-to-close
  const backdrop = document.createElement("div");
  backdrop.className = "backdrop";
  backdrop.addEventListener("click", (e) => {
    // Only close if clicking the backdrop itself, not children
    if (e.target === backdrop) {
      removeCommandMenu();
    }
  });

  // Global escape key handler
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      removeCommandMenu();
    }
  };
  backdrop.addEventListener("keydown", handleEscape);

  const container = document.createElement("div");
  container.className = "command-menu";

  // Search container with icon
  const searchContainer = document.createElement("div");
  searchContainer.className = "search-container";

  const searchIcon = document.createElement("div");
  searchIcon.className = "search-icon";
  searchIcon.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="11" cy="11" r="8"></circle>
      <path d="m21 21-4.35-4.35"></path>
    </svg>
  `;
  searchContainer.appendChild(searchIcon);

  const searchInput = document.createElement("input");
  searchInput.className = "search-input";
  searchInput.type = "text";
  searchInput.placeholder = "Search commands...";
  searchContainer.appendChild(searchInput);

  container.appendChild(searchContainer);

  const commandsContainer = document.createElement("div");
  commandsContainer.className = "commands-container";
  container.appendChild(commandsContainer);

  // Footer with shortcuts
  const footer = document.createElement("div");
  footer.className = "footer";
  footer.innerHTML = `
    <div class="footer-shortcuts">
      <div class="footer-shortcut">
        <span class="footer-key">↑↓</span>
        <span>Navigate</span>
      </div>
      <div class="footer-shortcut">
        <span class="footer-key">↵</span>
        <span>Select</span>
      </div>
      <div class="footer-shortcut">
        <span class="footer-key">Esc</span>
        <span>Close</span>
      </div>
    </div>
    <div>${options.length} command${options.length === 1 ? "" : "s"}</div>
  `;
  container.appendChild(footer);

  let selectedIndex = 0;
  let currentQuery = "";

  function renderCommands(filteredOptions: CommandOption[]) {
    commandsContainer.innerHTML = "";

    if (filteredOptions.length === 0) {
      const noResults = document.createElement("div");
      noResults.className = "no-results";
      noResults.innerHTML = `
        <div class="no-results-icon">🔍</div>
        <div>No commands found</div>
      `;
      commandsContainer.appendChild(noResults);
      return;
    }

    // Group by category
    const selectionCommands = filteredOptions.filter(
      (o) => o.category === "selection",
    );
    const articleCommands = filteredOptions.filter(
      (o) => o.category === "article",
    );

    let globalIndex = 0;

    // Render selection commands
    if (selectionCommands.length > 0) {
      const categoryHeader = document.createElement("div");
      categoryHeader.className = "category-header";
      categoryHeader.textContent = "Selection Commands";
      commandsContainer.appendChild(categoryHeader);

      for (const option of selectionCommands) {
        const item = createCommandItem(option, globalIndex === selectedIndex);
        commandsContainer.appendChild(item);
        globalIndex++;
      }
    }

    // Render article commands
    if (articleCommands.length > 0) {
      const categoryHeader = document.createElement("div");
      categoryHeader.className = "category-header";
      categoryHeader.textContent = "Article Commands";
      commandsContainer.appendChild(categoryHeader);

      for (const option of articleCommands) {
        const item = createCommandItem(option, globalIndex === selectedIndex);
        commandsContainer.appendChild(item);
        globalIndex++;
      }
    }
  }

  function createCommandItem(
    option: CommandOption,
    isSelected: boolean,
  ): HTMLElement {
    const item = document.createElement("button");
    item.className = `command-item${isSelected ? " selected" : ""}`;

    // Icon
    if (option.icon) {
      const icon = document.createElement("div");
      icon.className = "command-item-icon";
      icon.textContent = option.icon;
      item.appendChild(icon);
    }

    // Content
    const content = document.createElement("div");
    content.className = "command-item-content";

    const label = document.createElement("div");
    label.className = "command-item-label";
    label.innerHTML = highlightText(option.label, currentQuery);
    content.appendChild(label);

    if (option.description) {
      const description = document.createElement("div");
      description.className = "command-item-description";
      description.innerHTML = highlightText(option.description, currentQuery);
      content.appendChild(description);
    }

    item.appendChild(content);

    // Shortcut
    if (option.shortcut) {
      const shortcutContainer = document.createElement("div");
      shortcutContainer.className = "command-item-shortcut";

      const shortcutKey = document.createElement("span");
      shortcutKey.className = "shortcut-key";
      shortcutKey.textContent = option.shortcut;
      shortcutContainer.appendChild(shortcutKey);

      item.appendChild(shortcutContainer);
    }

    item.addEventListener("click", async () => {
      await option.action();
      removeCommandMenu();
    });

    return item;
  }

  let filteredOptions = options;
  renderCommands(filteredOptions);

  // Search functionality
  searchInput.addEventListener("input", () => {
    currentQuery = searchInput.value;
    const query = currentQuery.toLowerCase();
    filteredOptions = options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(query) ||
        opt.description?.toLowerCase().includes(query),
    );
    selectedIndex = 0;
    renderCommands(filteredOptions);
  });

  // Keyboard navigation
  searchInput.addEventListener("keydown", async (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      removeCommandMenu();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, filteredOptions.length - 1);
      renderCommands(filteredOptions);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
      renderCommands(filteredOptions);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const selected = filteredOptions[selectedIndex];
      if (selected) {
        await selected.action();
        removeCommandMenu();
      }
    }
  });

  // Append container to backdrop
  backdrop.appendChild(container);

  // Clear previous content but preserve styles
  const style = root.querySelector("style");
  root.innerHTML = "";
  if (style) {
    root.appendChild(style);
  }
  root.appendChild(backdrop);

  // Auto-focus the search input
  setTimeout(() => searchInput.focus(), 50);
}

/**
 * Extract article content using Readability
 */
export function extractArticleContent(): {
  title: string;
  content: string;
  textContent: string;
} | null {
  try {
    // Clone the document to avoid modifying the original
    const documentClone = document.cloneNode(true) as Document;
    const reader = new Readability(documentClone);
    const article = reader.parse();

    if (!article) {
      return null;
    }

    return {
      title: article.title || "",
      content: article.content || "",
      textContent: (article.textContent || "").trim(),
    };
  } catch (err) {
    console.error("Failed to extract article content:", err);
    return null;
  }
}

/**
 * Check if user has selected text
 */
export function hasTextSelection(): boolean {
  const selection = window.getSelection();
  return !!(selection && selection.toString().trim().length > 0);
}

/**
 * Initialize keyboard shortcut listener
 */
export function initCommandMenuShortcut(
  onCopyWithTemplate: (
    templateId: string,
    type: "selection" | "article",
  ) => void | Promise<void>,
): () => void {
  const handleKeyDown = async (e: KeyboardEvent) => {
    // Check for cmd-k (Mac) or ctrl-k (Windows/Linux)
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      e.stopPropagation();

      // Dynamically import to avoid circular dependency
      const { getSettings } = await import("../common/storage");
      const settings = await getSettings();

      const options: CommandOption[] = [];
      const hasSelection = hasTextSelection();

      // Add selection templates if user has selected text
      if (hasSelection) {
        const selectionTemplates = settings.templates.filter(
          (t) => t.type === "selection",
        );
        let shortcutIndex = 1;
        for (const template of selectionTemplates) {
          options.push({
            id: template.id,
            label: template.name,
            description: template.description,
            icon: "📝",
            category: "selection",
            action: () => onCopyWithTemplate(template.id, "selection"),
          });
          shortcutIndex++;
        }
      }

      // Add article templates
      const articleTemplates = settings.templates.filter(
        (t) => t.type === "article",
      );
      let shortcutIndex = 1;
      for (const template of articleTemplates) {
        options.push({
          id: template.id,
          label: template.name,
          description: template.description,
          icon: "📄",
          category: "article",
          action: () => onCopyWithTemplate(template.id, "article"),
        });
        shortcutIndex++;
      }

      showCommandMenu(options);
    }
  };

  document.addEventListener("keydown", handleKeyDown);

  // Return cleanup function
  return () => {
    document.removeEventListener("keydown", handleKeyDown);
  };
}
