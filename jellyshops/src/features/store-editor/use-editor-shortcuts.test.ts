import { expect, it } from "vitest";
import { shortcutFor } from "./use-editor-shortcuts";

const key = (value: string, extra: Partial<KeyboardEvent> = {}, target: EventTarget | null = document.body) => ({ key: value, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, target, ...extra });

it("maps Shopify-style shortcuts and ignores them while typing", () => {
  expect(shortcutFor(key("z", { ctrlKey: true }))).toBe("undo");
  expect(shortcutFor(key("Z", { metaKey: true, shiftKey: true }))).toBe("redo");
  expect(shortcutFor(key("y", { ctrlKey: true }))).toBe("redo");
  expect(shortcutFor(key("s", { ctrlKey: true }))).toBe("save");
  expect(shortcutFor(key("d", { metaKey: true }))).toBe("duplicate");
  expect(shortcutFor(key("Delete"))).toBe("remove");
  expect(shortcutFor(key("Escape"))).toBe("deselect");
  const input = document.createElement("input");
  expect(shortcutFor(key("Backspace", {}, input))).toBeNull();
  expect(shortcutFor(key("z", { ctrlKey: true }, input))).toBeNull();
  expect(shortcutFor(key("s", { ctrlKey: true }, input))).toBe("save");
  expect(shortcutFor(key("z", { ctrlKey: true, altKey: true }))).toBeNull();
});
