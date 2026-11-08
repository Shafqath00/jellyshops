import { beforeEach, expect, it } from "vitest";
import { clearUnsaved, describeUnsaved, findRestorableWork, readUnsaved, rememberUnsaved, stableStringify } from "./unsaved-work";

beforeEach(() => window.localStorage.clear());

it("compares data without caring about key order", () => {
  expect(stableStringify({ b: 1, a: { d: [1, { y: 2, x: 1 }], c: undefined } })).toBe(stableStringify({ a: { d: [1, { x: 1, y: 2 }] }, b: 1 }));
  expect(stableStringify({ a: 1 })).not.toBe(stableStringify({ a: 2 }));
});

it("remembers the latest version of each changed thing, per store", () => {
  rememberUnsaved("store-a", { kind: "template", id: "home", baseRevision: 3, value: { sections: [1] } }, 100);
  rememberUnsaved("store-a", { kind: "template", id: "home", baseRevision: 3, value: { sections: [1, 2] } }, 200);
  rememberUnsaved("store-a", { kind: "theme", id: "theme", baseRevision: 1, value: { colors: {} } }, 300);
  const work = readUnsaved("store-a")!;
  expect(work.savedAt).toBe(300);
  expect(Object.keys(work.items)).toEqual(["template:home", "theme:theme"]);
  expect(work.items["template:home"].value).toEqual({ sections: [1, 2] });
  expect(readUnsaved("store-b")).toBeNull();
  clearUnsaved("store-a");
  expect(readUnsaved("store-a")).toBeNull();
});

it("ignores damaged or unknown stored data", () => {
  window.localStorage.setItem("jelly-editor-unsaved:s", "{not json");
  expect(readUnsaved("s")).toBeNull();
  window.localStorage.setItem("jelly-editor-unsaved:s", JSON.stringify({ version: 2, savedAt: 1, items: {} }));
  expect(readUnsaved("s")).toBeNull();
  window.localStorage.setItem("jelly-editor-unsaved:s", JSON.stringify({ version: 1, savedAt: 1, items: { ok: { kind: "theme", id: "theme", baseRevision: 1, value: {} }, bad: { kind: "page", id: "x", baseRevision: 1, value: {} }, worse: { kind: "theme", id: "t", baseRevision: "1", value: {} } } }));
  expect(Object.keys(readUnsaved("s")!.items)).toEqual(["ok"]);
});

it("offers back only what differs from the saved version and still exists", () => {
  rememberUnsaved("s", { kind: "template", id: "home", baseRevision: 2, value: { sections: ["new"], type: "home" } });
  rememberUnsaved("s", { kind: "template", id: "same", baseRevision: 2, value: { type: "page", sections: [] } });
  rememberUnsaved("s", { kind: "template", id: "deleted", baseRevision: 2, value: { sections: ["x"] } });
  rememberUnsaved("s", { kind: "global", id: "footer", baseRevision: 1, value: { text: "changed" } });
  rememberUnsaved("s", { kind: "theme", id: "theme", baseRevision: 4, value: { colors: { primary: "#111111" } } });
  const found = findRestorableWork(readUnsaved("s")!, {
    templates: [{ id: "home", layout: { type: "home", sections: [] } }, { id: "same", layout: { sections: [], type: "page" } }],
    globals: [{ id: "footer", section: { text: "saved" } }],
    theme: { settings: { colors: { primary: "#111111" } } },
  });
  expect(Object.keys(found.items)).toEqual(["template:home", "global:footer"]);
  expect(describeUnsaved(found)).toBe("1 page and 1 shared section");
  expect(describeUnsaved({ ...found, items: { ...found.items, t: { kind: "theme", id: "theme", baseRevision: 1, value: {} }, p: { kind: "template", id: "other", baseRevision: 1, value: {} } } })).toBe("2 pages, 1 shared section and theme settings");
});
