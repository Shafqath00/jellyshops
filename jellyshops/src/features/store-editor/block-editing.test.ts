import { expect, it } from "vitest";
import type { SectionNode } from "@jelly/storefront-schema";
import { addBlockTo, childBlockOptions, createBlock, locateBlock, patchBlockSettings } from "./block-editing";

const section = (): SectionNode => ({
  id: "s", type: "custom-content", enabled: true, settings: {},
  blocks: [
    { id: "h", type: "heading", enabled: true, settings: { text: "Hi" } },
    { id: "g", type: "group", enabled: true, settings: {}, blocks: [{ id: "b", type: "button", enabled: true, settings: { label: "Go" } }] },
  ],
});

it("finds and edits a block inside a group", () => {
  expect(locateBlock(section(), "b")?.parent?.id).toBe("g");
  expect(locateBlock(section(), undefined)).toBeNull();
  const edited = patchBlockSettings(section(), "b", { label: "Shop", buttonSize: "large" });
  expect(edited.blocks[1].blocks![0].settings).toEqual({ label: "Shop", buttonSize: "large" });
});

it("creates a group with its starter buttons under fresh ids and adds blocks to it", () => {
  let next = 0;
  const group = createBlock("group", () => `n${++next}`)!;
  expect(group).toMatchObject({ id: "n1", type: "group", settings: { groupDirection: "horizontal" } });
  expect(group.blocks!.map(({ id, type }) => `${id}:${type}`)).toEqual(["n2:button", "n3:button"]);
  expect(createBlock("heading", () => "x")).not.toHaveProperty("blocks");
  expect(createBlock("nope")).toBeNull();
  const added = addBlockTo(section(), "g", createBlock("text", () => "t")!);
  expect(added.blocks[1].blocks!.map(({ id }) => id)).toEqual(["b", "t"]);
  expect(addBlockTo(section(), undefined, createBlock("text", () => "t")!).blocks.map(({ id }) => id)).toEqual(["h", "g", "t"]);
});

it("offers child blocks only for groups, and says when a group is full", () => {
  const options = childBlockOptions(section(), "g");
  expect(options.full).toBe(false);
  expect(options.types).toEqual(expect.arrayContaining(["heading", "text", "button", "image", "video", "app", "group", "grid", "card"]));
  // A group inside a group holds plain blocks only.
  const nested = section();
  nested.blocks[1].blocks = [{ id: "inner", type: "group", enabled: true, settings: {}, blocks: [] }];
  const inner = childBlockOptions(nested, "inner").types;
  expect(inner).toEqual(expect.arrayContaining(["heading", "text", "button", "image", "video", "app", "card"]));
  for (const holder of ["group", "grid", "accordion", "tabs"]) expect(inner).not.toContain(holder);
  expect(childBlockOptions(section(), "h").types).toEqual([]);
  const full = section();
  full.blocks[1].blocks = Array.from({ length: 8 }, (_, index) => ({ id: `b${index}`, type: "button", enabled: true, settings: {} }));
  expect(childBlockOptions(full, "g").full).toBe(true);
});
