import type {
  Combo,
  EventBinding,
  EventPayload,
  EventSpec,
  TextSelectPayload,
} from "./types";

type Disposer = () => void;
type RegisterItem = string | EventBinding;

class Disposables {
  private ds: Array<() => void> = [];
  add(d?: () => undefined | undefined) {
    if (typeof d === "function") this.ds.push(d);
  }
  flush() {
    for (const d of this.ds.splice(0))
      try {
        d();
      } catch {}
  }
}

export class EventSystem {
  private bindings = new Map<string, EventBinding>();
  private layers: string[] = ["global"];
  private bindingIdCounter = 0;

  constructor() {
    document.addEventListener("keydown", this.onKeyDown, { capture: true });
    document.addEventListener("mousedown", this.onMouseDown, true);
    window.addEventListener("scroll", this.onScroll, { passive: true });
    document.addEventListener("selectionchange", this.onSelectionChange);
    document.addEventListener("mouseup", this.onSelectionFinalize, true);
    document.addEventListener("touchend", this.onSelectionFinalize, true);
  }

  dispose() {
    document.removeEventListener("keydown", this.onKeyDown, {
      capture: true,
    } as any);
    document.removeEventListener("mousedown", this.onMouseDown, true);
    window.removeEventListener("scroll", this.onScroll as any);
    document.removeEventListener("selectionchange", this.onSelectionChange);
    document.removeEventListener("mouseup", this.onSelectionFinalize, true);
    document.removeEventListener("touchend", this.onSelectionFinalize, true);
  }

  // layers
  pushLayer(layer: string) {
    this.layers.push(layer);
  }
  popLayer(layer?: string) {
    if (!layer) {
      this.layers.pop();
      return;
    }
    const i = this.layers.lastIndexOf(layer);
    if (i >= 0) this.layers.splice(i, 1);
  }

  // register - simplified API that accepts array of string | EventBinding
  register(items: RegisterItem[]): Disposer {
    const bag = new Disposables();

    for (const item of items) {
      if (typeof item === "string") {
        // String means push/pop a layer
        this.pushLayer(item);
        bag.add(() => {
          this.popLayer(item);
        });
      } else {
        // EventBinding - register and track for disposal
        const id = item.id || `binding_${this.bindingIdCounter++}`;
        this.bindings.set(id, item);
        bag.add(() => {
          this.bindings.delete(id);
        });
      }
    }

    return () => bag.flush();
  }

  // dispatch entrypoint (used by synthetic sources)
  dispatch(spec: EventSpec, payload: Omit<EventPayload, "kind">) {
    this.route(spec, { kind: spec.kind, ...(payload as any) } as EventPayload);
  }

  // key normalize
  private combo(ev: KeyboardEvent): Combo {
    const parts: string[] = [];
    if (ev.ctrlKey) parts.push("ctrl");
    if (ev.metaKey) parts.push("meta");
    if (ev.altKey) parts.push("alt");
    if (ev.shiftKey) parts.push("shift");
    const key = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
    return ((parts.length ? `${parts.join("+")}+` : "") + key) as Combo;
  }

  // routers
  private onKeyDown = (ev: KeyboardEvent) => {
    const spec: EventSpec = { kind: "key", combo: this.combo(ev) };
    this.route(spec, { kind: "key", ev } as EventPayload);
  };

  private onMouseDown = (e: MouseEvent) => {
    this.dispatch({ kind: "bgClick" }, { ev: e });
  };

  private onScroll = (e: Event) => {
    this.dispatch({ kind: "bgScroll" }, { ev: e });
  };

  private selectionSnapshot: null | TextSelectPayload = null;

  private onSelectionChange = () => {
    const s = window.getSelection();
    if (!s || s.isCollapsed || !s.toString().trim()) {
      this.selectionSnapshot = null;
      return;
    }
    const range = s.rangeCount ? s.getRangeAt(0) : null;
    if (!range) return;

    const rect = range.getBoundingClientRect();
    this.selectionSnapshot = {
      selection: s,
      text: s.toString().trim(),
      range,
      rect,
    };
  };

  private onSelectionFinalize = () => {
    if (!this.selectionSnapshot) return;
    this.dispatch({ kind: "textSelect" }, this.selectionSnapshot);
  };

  private route(spec: EventSpec, payload: EventPayload) {
    const layersTopFirst = [...this.layers].reverse();

    const matches = (b: EventBinding) => {
      if (b.event.kind !== spec.kind) return false;
      if (spec.kind === "key" && b.event.kind === "key") {
        return b.event.combo === spec.combo;
      }
      if (spec.kind === "bgClick" && b.event.kind === "bgClick") {
        // Check if click is shielded
        if (b.event.shield && payload.kind === "bgClick") {
          const shield = b.event.shield();
          if (
            shield &&
            payload.ev.target instanceof Node &&
            shield.contains(payload.ev.target)
          ) {
            return false; // Click is inside shield, don't match
          }
        }
        return true;
      }
      if (spec.kind === "textSelect" && b.event.kind === "textSelect") {
        // Check if selection is within the specified container
        if (b.event.container && payload.kind === "textSelect") {
          const range = payload.range;
          const container = b.event.container;
          const commonAncestor = range.commonAncestorContainer;
          return container.contains(commonAncestor);
        }
        return true; // No container means global text selection
      }
      return true;
    };

    for (const layer of layersTopFirst) {
      // Convert Map values to array for filtering
      const bindings = Array.from(this.bindings.values());
      const cand = bindings
        .filter((b) => (b.layer ?? "global") === layer)
        .filter(matches)
        .filter((b) => !b.when || b.when({}))
        .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
      if (cand.length && cand[0]) {
        if (payload.kind === "key") (payload as any).ev.preventDefault();
        cand[0].run(payload);
        return;
      }
    }
  }
}
