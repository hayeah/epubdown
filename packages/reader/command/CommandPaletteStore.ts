import { action, computed, makeObservable, observable } from "mobx";
import type { AppEventSystem } from "../src/app/context";
import { calculatePosition, positionForSelection } from "./positioning";
import { rankCommands } from "./search";
import type {
  Command,
  CommandMode,
  OpenMenuOpts,
  OpenSelectionOpts,
} from "./types";

export class CommandPaletteStore {
  // config
  enableFilterInput = true;

  // ui state
  isOpen = false;
  mode: CommandMode = "palette";
  query = "";
  selectedIndex = 0;
  hoveredIndex: number | null = null;

  // positioning state
  anchorElement: HTMLElement | null = null;
  position: { x: number; y: number } | null = null;
  selectionRect: DOMRect | null = null;
  menuXY = { x: 0, y: 0 };
  widthPx = 560; // derived per mode in setter

  // commands
  private currentCommands: Command[] = [];
  lastAction = "";

  constructor(private events: AppEventSystem) {
    makeObservable(this, {
      // observable state
      enableFilterInput: observable,
      isOpen: observable,
      mode: observable,
      query: observable,
      selectedIndex: observable,
      hoveredIndex: observable,
      menuXY: observable,
      widthPx: observable,
      lastAction: observable,

      // computed
      filtered: computed,

      // actions
      setQuery: action,
      appendToQuery: action,
      backspaceQuery: action,
      clearQuery: action,
      moveSelection: action,
      selectFirst: action,
      selectLast: action,
      executeSelected: action,
      touchUsage: action,
      setHoveredIndex: action,
      setLastAction: action,
      openPalette: action,
      openMenu: action,
      openSlide: action,
      openSelection: action,
      close: action,
      computeMenuXY: action,
      bindMenuElGetter: action,
    });
  }

  get filtered(): Command[] {
    return rankCommands(this.currentCommands, this.query);
  }

  setupBindings(menuEl: () => HTMLElement | null) {
    return this.events.register([
      "overlay:palette",
      {
        id: "palette.close.esc",
        event: { kind: "key", combo: "Escape" },
        layer: "overlay:palette",
        run: () => this.close(),
      },
      {
        id: "palette.close.bgClick",
        event: { kind: "bgClick", shield: menuEl },
        layer: "overlay:palette",
        run: () => this.close(),
      },
      {
        id: "palette.close.bgScroll.selection",
        event: { kind: "bgScroll" },
        layer: "overlay:palette",
        when: () => this.mode === "selection",
        run: () => this.close(),
      },
    ]);
  }

  setQuery(q: string) {
    this.query = q;
    this.selectedIndex = 0;
  }

  appendToQuery(ch: string) {
    this.setQuery(this.query + ch);
  }

  backspaceQuery() {
    if (!this.query) return;
    this.setQuery(this.query.slice(0, -1));
  }

  clearQuery() {
    this.setQuery("");
  }

  moveSelection(delta: number) {
    const max = Math.max(0, this.filtered.length - 1);
    this.selectedIndex = Math.min(max, Math.max(0, this.selectedIndex + delta));
  }

  selectFirst() {
    this.selectedIndex = 0;
  }

  selectLast() {
    this.selectedIndex = Math.max(0, this.filtered.length - 1);
  }

  async executeSelected(onClose: () => void, idx?: number) {
    const cmd = this.filtered[idx || this.selectedIndex];
    if (!cmd) return;
    await cmd.action();
    this.setLastAction(cmd.label);
    this.touchUsage(cmd.id);
    onClose();
  }

  touchUsage(id: string) {
    const found = this.currentCommands.find((c) => c.id === id);
    if (found) found.lastUsed = Date.now();
  }

  setHoveredIndex(index: number | null) {
    this.hoveredIndex = index;
  }

  setLastAction(action: string) {
    this.lastAction = action;
  }

  // open and close
  openPalette(commands: Command[]) {
    this.mode = "palette";
    this.enableFilterInput = true;
    this.widthPx = 560;
    this.anchorElement = null;
    this.position = null;
    this.selectionRect = null;
    this.currentCommands = commands;
    this._open();
  }

  openMenu(commands: Command[], opts: OpenMenuOpts = {}) {
    this.mode = "menu";
    this.enableFilterInput = true;
    this.widthPx = 320;
    this.anchorElement = opts.anchorElement ?? null;
    this.position = opts.position ?? null;
    this.selectionRect = null;
    this.currentCommands = commands;
    this._open();
  }

  openSlide(commands: Command[]) {
    this.mode = "slide";
    this.enableFilterInput = true;
    this.widthPx = 480;
    this.anchorElement = null;
    this.position = null;
    this.selectionRect = null;
    this.currentCommands = commands;
    this._open();
  }

  openSelection(commands: Command[], opts: OpenSelectionOpts) {
    this.mode = "selection";
    this.enableFilterInput = false;
    this.widthPx = 320;

    // Do NOT save/clone ranges; rely on native selection
    const rect = opts.range.getBoundingClientRect();
    this.selectionRect = rect;
    this.currentCommands = commands;
    this._open();
  }

  close() {
    this.isOpen = false;
    this.query = "";
    this.hoveredIndex = null;
    this.selectionRect = null;

    // Do NOT clear the browser selection anymore
    // window.getSelection()?.removeAllRanges(); <-- removed
  }

  private _open() {
    this.isOpen = true;
    this.query = "";
    this.selectedIndex = 0;
    this.hoveredIndex = null;
    // computeMenuXY will be called after the menu is rendered via useLayoutEffect
  }

  // positioning
  computeMenuXY() {
    const menuEl = this._menuEl?.();
    if (!menuEl) return;

    if (this.selectionRect) {
      this.menuXY = positionForSelection(
        this.selectionRect,
        menuEl,
        10,
        "auto",
      );
      return;
    }

    if (this.mode === "slide") {
      // Center horizontally and position 10px from top for slide mode
      const menuRect = menuEl.getBoundingClientRect();
      this.menuXY = {
        x: (window.innerWidth - menuRect.width) / 2,
        y: 10,
      };
      return;
    }

    this.menuXY = calculatePosition(
      this.anchorElement,
      menuEl,
      this.position ?? undefined,
    );
  }

  // injected by component for measurements
  private _menuEl: (() => HTMLElement | null) | null = null;
  bindMenuElGetter(getter: () => HTMLElement | null) {
    this._menuEl = getter;
  }

  // Note: restoreSelection() method has been removed as we no longer save/restore selections
}
