import { beforeEach, describe, expect, it, vi } from "vitest";
import { EventSystem } from "./EventSystem";
import type { EventBinding, EventPayload } from "./types";

describe("EventSystem", () => {
  let eventSystem: EventSystem;

  beforeEach(() => {
    eventSystem = new EventSystem();
  });

  describe("layers", () => {
    it("should push and pop layers", () => {
      const dispose = eventSystem.register(["overlay"]);
      expect(() => dispose()).not.toThrow();
    });

    it("should handle multiple layers", () => {
      const dispose1 = eventSystem.register(["layer1"]);
      const dispose2 = eventSystem.register(["layer2"]);

      dispose2();
      dispose1();
    });
  });

  describe("bindings", () => {
    it("should register and unregister bindings", () => {
      const handler = vi.fn();
      const binding: EventBinding = {
        event: { kind: "key", combo: "a" },
        run: handler,
      };

      const dispose = eventSystem.register([binding]);

      // Trigger the event
      const keyEvent = new KeyboardEvent("keydown", { key: "a" });
      document.dispatchEvent(keyEvent);

      expect(handler).toHaveBeenCalled();

      dispose();
      handler.mockClear();

      // Should not trigger after disposal
      document.dispatchEvent(keyEvent);
      expect(handler).not.toHaveBeenCalled();
    });

    it("should handle bindings with layers", () => {
      const globalHandler = vi.fn();
      const overlayHandler = vi.fn();

      eventSystem.register([
        {
          event: { kind: "key", combo: "a" },
          layer: "global",
          run: globalHandler,
        },
      ]);

      const dispose = eventSystem.register([
        "overlay",
        {
          event: { kind: "key", combo: "a" },
          layer: "overlay",
          run: overlayHandler,
        },
      ]);

      const keyEvent = new KeyboardEvent("keydown", { key: "a" });
      document.dispatchEvent(keyEvent);

      // Overlay handler should be called (higher layer)
      expect(overlayHandler).toHaveBeenCalled();
      expect(globalHandler).not.toHaveBeenCalled();

      dispose();
      overlayHandler.mockClear();

      // After disposing overlay, global handler should be called
      document.dispatchEvent(keyEvent);
      expect(globalHandler).toHaveBeenCalled();
    });

    it("should respect priority within the same layer", () => {
      const lowPriorityHandler = vi.fn();
      const highPriorityHandler = vi.fn();

      eventSystem.register([
        {
          event: { kind: "key", combo: "a" },
          priority: 10,
          run: highPriorityHandler,
        },
        {
          event: { kind: "key", combo: "a" },
          priority: 5,
          run: lowPriorityHandler,
        },
      ]);

      const keyEvent = new KeyboardEvent("keydown", { key: "a" });
      document.dispatchEvent(keyEvent);

      // High priority handler should be called
      expect(highPriorityHandler).toHaveBeenCalled();
      expect(lowPriorityHandler).not.toHaveBeenCalled();
    });

    it("should handle when conditions", () => {
      const handler = vi.fn();
      let shouldRun = false;

      eventSystem.register([
        {
          event: { kind: "key", combo: "a" },
          when: () => shouldRun,
          run: handler,
        },
      ]);

      const keyEvent = new KeyboardEvent("keydown", { key: "a" });

      // Should not run when condition is false
      document.dispatchEvent(keyEvent);
      expect(handler).not.toHaveBeenCalled();

      // Should run when condition is true
      shouldRun = true;
      document.dispatchEvent(keyEvent);
      expect(handler).toHaveBeenCalled();
    });
  });

  describe("key events", () => {
    it("should handle simple key press", () => {
      const handler = vi.fn();
      eventSystem.register([
        {
          event: { kind: "key", combo: "Enter" },
          run: handler,
        },
      ]);

      const keyEvent = new KeyboardEvent("keydown", { key: "Enter" });
      document.dispatchEvent(keyEvent);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ kind: "key", ev: keyEvent }),
      );
    });

    it("should handle key combinations with modifiers", () => {
      const handler = vi.fn();
      eventSystem.register([
        {
          event: { kind: "key", combo: "ctrl+shift+a" },
          run: handler,
        },
      ]);

      const keyEvent = new KeyboardEvent("keydown", {
        key: "a",
        ctrlKey: true,
        shiftKey: true,
      });
      document.dispatchEvent(keyEvent);

      expect(handler).toHaveBeenCalled();
    });

    it("should normalize single character keys to lowercase", () => {
      const handler = vi.fn();
      eventSystem.register([
        {
          event: { kind: "key", combo: "a" },
          run: handler,
        },
      ]);

      const keyEvent = new KeyboardEvent("keydown", { key: "A" });
      document.dispatchEvent(keyEvent);

      expect(handler).toHaveBeenCalled();
    });
  });

  describe("background click events", () => {
    it("should handle background clicks", () => {
      const handler = vi.fn();
      eventSystem.register([
        {
          event: { kind: "bgClick" },
          run: handler,
        },
      ]);

      const mouseEvent = new MouseEvent("mousedown");
      document.dispatchEvent(mouseEvent);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ kind: "bgClick", ev: mouseEvent }),
      );
    });

    it("should respect shield elements", () => {
      const handler = vi.fn();
      const shieldElement = document.createElement("div");
      document.body.appendChild(shieldElement);

      eventSystem.register([
        {
          event: {
            kind: "bgClick",
            shield: () => shieldElement,
          },
          run: handler,
        },
      ]);

      // Click inside shield - should not trigger
      const insideClick = new MouseEvent("mousedown", {
        bubbles: true,
      });
      Object.defineProperty(insideClick, "target", { value: shieldElement });
      document.dispatchEvent(insideClick);
      expect(handler).not.toHaveBeenCalled();

      // Click outside shield - should trigger
      const outsideElement = document.createElement("div");
      const outsideClick = new MouseEvent("mousedown", {
        bubbles: true,
      });
      Object.defineProperty(outsideClick, "target", { value: outsideElement });
      document.dispatchEvent(outsideClick);
      expect(handler).toHaveBeenCalled();

      document.body.removeChild(shieldElement);
    });
  });

  describe("dispatch", () => {
    it("should dispatch synthetic events", () => {
      const handler = vi.fn();
      eventSystem.register([
        {
          event: { kind: "bgScroll" },
          run: handler,
        },
      ]);

      const event = new Event("scroll");
      eventSystem.dispatch({ kind: "bgScroll" }, { ev: event });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ kind: "bgScroll", ev: event }),
      );
    });
  });

  describe("dispose", () => {
    it("should remove event listeners when disposed", () => {
      const system = new EventSystem();
      const handler = vi.fn();

      system.register([
        {
          event: { kind: "key", combo: "a" },
          run: handler,
        },
      ]);

      system.dispose();

      // Events should not be handled after disposal
      const keyEvent = new KeyboardEvent("keydown", { key: "a" });
      document.dispatchEvent(keyEvent);
      expect(handler).not.toHaveBeenCalled();
    });
  });
});
