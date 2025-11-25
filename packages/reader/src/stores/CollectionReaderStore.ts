import { makeAutoObservable, runInAction } from "mobx";
import type { CommandPaletteStore } from "../../command/CommandPaletteStore";
import type { Command } from "../../command/types";
import type {
  CollectionFile,
  CollectionMetadata,
} from "../lib/CollectionDatabase";
import type { CollectionManager } from "../lib/CollectionManager";
import type { AppEventSystem } from "../app/context";
import { CollectionTemplateContext } from "../templates/CollectionTemplateContext";
import type { ReaderTemplates } from "../templates/Template";
import { copyToClipboard } from "../utils/selectionUtils";
import { extractHeadings, parseMarkdownFile } from "../utils/parseMarkdownFile";
import { compareFileNames } from "../utils/compareFileNames";

export interface CollectionTocItem {
  id: string;
  label: string;
  level: number;
  filePath?: string; // For file entries
  headingIndex?: number; // For heading entries within a file
}

export interface LoadedMarkdownFile {
  filePath: string;
  title?: string;
  content: string;
  headings: Array<{ level: number; text: string }>;
}

export class CollectionReaderStore {
  collection: CollectionMetadata | null = null;
  files: CollectionFile[] = [];
  mediaFiles: CollectionFile[] = [];
  currentFilePath: string | null = null;
  currentFile: LoadedMarkdownFile | null = null;
  isSidebarOpen = false;
  isLoading = false;

  // Image URL cache (blob URLs)
  private imageUrlCache: Map<string, string> = new Map();

  private templateContext: CollectionTemplateContext;

  constructor(
    private readonly manager: CollectionManager,
    private events: AppEventSystem,
    private palette: CommandPaletteStore,
    private templates: ReaderTemplates,
  ) {
    this.templateContext = new CollectionTemplateContext(this, palette);
    makeAutoObservable(this);
  }

  async load(
    collectionId: number,
    collection: CollectionMetadata,
  ): Promise<void> {
    this.isLoading = true;

    try {
      const allFiles = await this.manager.getFiles(collectionId);
      const markdownFiles = allFiles.filter((f) => f.fileType === "markdown");
      const mediaFiles = allFiles.filter((f) => f.fileType !== "markdown");

      // Sort files naturally by filename for consistent display order
      markdownFiles.sort((a, b) => compareFileNames(a.filePath, b.filePath));
      mediaFiles.sort((a, b) => compareFileNames(a.filePath, b.filePath));

      runInAction(() => {
        this.collection = collection;
        this.files = markdownFiles;
        this.mediaFiles = mediaFiles;
        this.isLoading = false;
      });

      // Load the first markdown file by default
      const firstFile = markdownFiles[0];
      if (firstFile && !this.currentFilePath) {
        await this.loadFile(firstFile.filePath);
      }
    } catch (error) {
      runInAction(() => {
        this.isLoading = false;
      });
      throw error;
    }
  }

  async loadFile(filePath: string): Promise<void> {
    if (!this.collection) return;

    this.isLoading = true;

    // Check if this is a media file
    const isMediaFile = this.mediaFiles.some((f) => f.filePath === filePath);

    try {
      // For media files, just set the current path without loading content
      if (isMediaFile) {
        runInAction(() => {
          this.currentFilePath = filePath;
          this.currentFile = null;
          this.isLoading = false;
        });
        return;
      }

      // For markdown files, load and parse content
      const content = await this.manager.getFileContent(
        this.collection.id,
        filePath,
      );
      if (!content) {
        throw new Error(`File not found: ${filePath}`);
      }

      const text = new TextDecoder().decode(content);
      const parsed = parseMarkdownFile(text);
      const headings = extractHeadings(parsed.content);

      // Find the file metadata for title fallback
      const fileMeta = this.files.find((f) => f.filePath === filePath);

      runInAction(() => {
        this.currentFilePath = filePath;
        this.currentFile = {
          filePath,
          title: parsed.title || fileMeta?.title || filePath,
          content: parsed.content,
          headings,
        };
        this.isLoading = false;
      });
    } catch (error) {
      runInAction(() => {
        this.isLoading = false;
      });
      throw error;
    }
  }

  get currentFileIndex(): number {
    if (!this.currentFilePath) return -1;
    return this.files.findIndex((f) => f.filePath === this.currentFilePath);
  }

  get hasNextFile(): boolean {
    return this.currentFileIndex < this.files.length - 1;
  }

  get hasPreviousFile(): boolean {
    return this.currentFileIndex > 0;
  }

  async nextFile(): Promise<void> {
    if (this.hasNextFile) {
      const nextIndex = this.currentFileIndex + 1;
      const nextFile = this.files[nextIndex];
      if (nextFile) {
        await this.loadFile(nextFile.filePath);
      }
    }
  }

  async previousFile(): Promise<void> {
    if (this.hasPreviousFile) {
      const prevIndex = this.currentFileIndex - 1;
      const prevFile = this.files[prevIndex];
      if (prevFile) {
        await this.loadFile(prevFile.filePath);
      }
    }
  }

  /**
   * Build TOC items for the sidebar
   * Level 1: Markdown files
   * Level 2: Headings within current file
   * Level 3: Media section at the bottom
   */
  get tocItems(): CollectionTocItem[] {
    const items: CollectionTocItem[] = [];

    // Add markdown files
    for (const [i, file] of this.files.entries()) {
      items.push({
        id: `file-${i}`,
        label: file.title || file.filePath,
        level: 0,
        filePath: file.filePath,
      });

      // Add headings for the current file
      if (
        file.filePath === this.currentFilePath &&
        this.currentFile?.headings
      ) {
        for (const [j, heading] of this.currentFile.headings.entries()) {
          items.push({
            id: `heading-${i}-${j}`,
            label: heading.text,
            level: heading.level,
            filePath: file.filePath,
            headingIndex: j,
          });
        }
      }
    }

    // Add media section if there are media files
    if (this.mediaFiles.length > 0) {
      items.push({
        id: "media-section",
        label: "Media",
        level: 0,
      });

      for (const [i, file] of this.mediaFiles.entries()) {
        items.push({
          id: `media-${i}`,
          label: file.filePath,
          level: 0,
          filePath: file.filePath,
        });
      }
    }

    return items;
  }

  /**
   * Get a data URL for an image file in the collection
   * Caches URLs to avoid recreating blob URLs
   */
  async getImageUrl(filePath: string): Promise<string | null> {
    if (!this.collection) return null;

    // Check cache first
    const cached = this.imageUrlCache.get(filePath);
    if (cached) return cached;

    const url = await this.manager.getFileDataUrl(this.collection.id, filePath);
    if (url) {
      this.imageUrlCache.set(filePath, url);
    }
    return url;
  }

  /**
   * Resolve a relative image path from markdown content
   */
  resolveImagePath(src: string): string {
    // If it's already an absolute URL, return as-is
    if (src.startsWith("http://") || src.startsWith("https://")) {
      return src;
    }

    // Remove leading ./ if present
    let resolved = src;
    if (resolved.startsWith("./")) {
      resolved = resolved.slice(2);
    }

    return resolved;
  }

  setSidebarOpen(open: boolean): void {
    this.isSidebarOpen = open;
  }

  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  reset(): void {
    // Revoke all cached blob URLs
    for (const url of this.imageUrlCache.values()) {
      URL.revokeObjectURL(url);
    }
    this.imageUrlCache.clear();

    this.collection = null;
    this.files = [];
    this.mediaFiles = [];
    this.currentFilePath = null;
    this.currentFile = null;
    this.isSidebarOpen = false;
    this.isLoading = false;
  }

  // Command palette methods
  setupBindings(
    scope: "view" | "overlay:sidebar",
    readerContainer?: HTMLElement,
    sidebarElement?: () => HTMLElement | null,
  ) {
    if (scope === "view") {
      return this.events.register([
        "view:collection", // Push the layer
        {
          id: "collection.openCommandPalette",
          event: { kind: "key", combo: "meta+k" },
          layer: "view:collection",
          when: () => !!this.currentFile,
          run: () => {
            const commands = this.buildGlobalCommands();
            this.palette.openPalette(commands);
          },
        },
        {
          id: "collection.copyWithContext",
          event: { kind: "key", combo: "meta+shift+c" },
          layer: "view:collection",
          when: () => !!this.currentFile,
          run: () => this.copySelectionWithContext(),
        },
        {
          id: "collection.toggleSidebar",
          event: { kind: "key", combo: "meta+shift+s" },
          layer: "view:collection",
          when: () => !!this.collection,
          run: () => this.toggleSidebar(),
        },
        {
          id: "collection.selection.openPalette",
          event: { kind: "textSelect", container: readerContainer },
          layer: "view:collection",
          when: () => !!this.currentFile && !!readerContainer,
          run: (payload) => {
            if (payload.kind !== "textSelect") return;
            const selected = payload.text.trim();
            if (!selected) return;
            const cmds = this.buildSelectionCommands(selected);
            this.palette.openSelection(cmds, { range: payload.range });
          },
        },
      ]);
    }

    if (scope === "overlay:sidebar" && sidebarElement) {
      return this.events.register([
        "overlay:sidebar",
        {
          id: "sidebar.close.bgClick",
          event: { kind: "bgClick", shield: sidebarElement },
          layer: "overlay:sidebar",
          when: () => this.isSidebarOpen,
          run: () => this.setSidebarOpen(false),
        },
        {
          id: "sidebar.close.escape",
          event: { kind: "key", combo: "Escape" },
          layer: "overlay:sidebar",
          when: () => this.isSidebarOpen,
          run: () => this.setSidebarOpen(false),
        },
      ]);
    }

    return () => {};
  }

  private async copySelectionWithContext() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    // Try to use template if available
    const copyTemplate = this.templates.selection.find(
      (t) => t.id === "copy-with-context",
    );
    if (!copyTemplate) {
      // Fallback to just copying the text
      copyToClipboard(selection.toString());
      return;
    }

    // Create context and render template
    const output = await copyTemplate.render(this.templateContext);
    copyToClipboard(output);
  }

  private buildSelectionCommands(selected: string): Command[] {
    const commands: Command[] = [];

    // Generate commands from selection templates
    for (const def of this.templates.selection) {
      commands.push({
        id: def.id,
        label: def.title,
        scope: "context",
        action: async () => {
          const output = await def.render(this.templateContext);
          copyToClipboard(output);
        },
      });
    }

    return commands;
  }

  private buildGlobalCommands(): Command[] {
    const commands: Command[] = [];

    // Generate commands from global templates
    for (const def of this.templates.global) {
      commands.push({
        id: def.id,
        label: def.title,
        scope: "global",
        action: async () => {
          const output = await def.render(this.templateContext);
          copyToClipboard(output);
        },
      });
    }

    return commands;
  }
}
