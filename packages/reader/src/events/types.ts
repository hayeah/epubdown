export type Combo =
  `${"" | "ctrl+"}${"" | "meta+"}${"" | "alt+"}${"" | "shift+"}${string}`;

export type EventSpec =
  | { kind: "key"; combo: Combo }
  | { kind: "bgClick"; shield?: () => HTMLElement | null }
  | { kind: "bgScroll" }
  | { kind: "textSelect"; container?: HTMLElement };

export type TextSelectPayload = {
  selection: Selection;
  text: string;
  range: Range;
  rect: DOMRect;
};

export type EventPayload =
  | { kind: "key"; ev: KeyboardEvent }
  | { kind: "bgClick"; ev: MouseEvent }
  | { kind: "bgScroll"; ev: Event }
  | ({ kind: "textSelect" } & TextSelectPayload);

export interface EventBinding {
  id?: string;
  event: EventSpec;
  layer?: string;
  when?: (ctx: any) => boolean;
  priority?: number;
  run: (payload: EventPayload) => void;
}
