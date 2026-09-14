import { expect, it } from "vitest";
import { reorderMenuItem } from "./menu-editor";

it("reorders a nested item without changing stable ids or targets", () => {
  const items = [{
    id: "parent",
    label: "Parent",
    target: { kind: "home" as const },
    children: [
      { id: "first", label: "First", target: { kind: "page" as const, resourceId: "page-1" }, children: [] },
      { id: "second", label: "Second", target: { kind: "external" as const, url: "https://example.com" }, children: [] },
    ],
  }];

  const reordered = reorderMenuItem(items, "second", { parentId: "parent", index: 0 });

  expect(reordered[0].children.map((item) => item.id)).toEqual(["second", "first"]);
  expect(reordered[0].children[1].target).toEqual({ kind: "page", resourceId: "page-1" });
});
