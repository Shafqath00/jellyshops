import { expect, it } from "vitest";
import { copyBlockWithNewIds, findBlock, flattenBlocks, updateBlock, updateBlockList } from "./block-tree.js";
import { storeDesignDocumentSchema } from "./schema.js";
import { createDefaultStoreDesign } from "./defaults.js";
import type { BlockNode } from "./types.js";

const leaf = (id: string): BlockNode => ({ id, type: "button", enabled: true, settings: { label: id } });
const blocks = (): BlockNode[] => [leaf("a"), { id: "g", type: "group", enabled: true, settings: {}, blocks: [leaf("g1"), leaf("g2")] }];

it("finds a block at any depth with its parent and position", () => {
  expect(findBlock(blocks(), "a")).toMatchObject({ parent: null, index: 0, depth: 1 });
  expect(findBlock(blocks(), "g2")).toMatchObject({ block: { id: "g2" }, parent: { id: "g" }, index: 1, depth: 2 });
  expect(findBlock(blocks(), "missing")).toBeNull();
  expect(flattenBlocks(blocks()).map(({ id }) => id)).toEqual(["a", "g", "g1", "g2"]);
});

it("changes a nested block or list without touching the input", () => {
  const input = blocks();
  const renamed = updateBlock(input, "g1", (block) => ({ ...block, settings: { label: "New" } }));
  expect(renamed[1].blocks![0].settings.label).toBe("New");
  expect(input[1].blocks![0].settings.label).toBe("g1");
  const reordered = updateBlockList(input, "g", (list) => list.reverse());
  expect(reordered[1].blocks!.map(({ id }) => id)).toEqual(["g2", "g1"]);
  expect(updateBlockList(input, undefined, (list) => list.slice(1)).map(({ id }) => id)).toEqual(["g"]);
});

it("copies a group with fresh ids for every block inside it", () => {
  let next = 0;
  const copy = copyBlockWithNewIds(blocks()[1], () => `n${++next}`);
  expect([copy.id, ...copy.blocks!.map(({ id }) => id)]).toEqual(["n1", "n2", "n3"]);
});

it("keeps blocks inside blocks when a saved design is read", () => {
  const design = createDefaultStoreDesign("store");
  const section = design.pages.home.sections[0];
  section.blocks = blocks();
  const parsed = storeDesignDocumentSchema.parse(design);
  expect(parsed.pages.home.sections[0].blocks[1].blocks?.map(({ id }) => id)).toEqual(["g1", "g2"]);
});
