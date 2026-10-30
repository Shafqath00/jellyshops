import { expect, it } from "vitest";
import type { BlockNode, SectionNode } from "@jelly/storefront-schema";
import { getBlockDefinition, validateSectionAgainstRegistry } from "./registry.js";

const button = (id: string): BlockNode => ({ id, type: "button", enabled: true, settings: { label: id, href: "/shop" } });
const group = (children: BlockNode[], settings: Record<string, unknown> = {}): BlockNode => ({ id: "g", type: "group", enabled: true, settings, blocks: children });
const section = (blocks: BlockNode[]): SectionNode => ({ id: "s", type: "custom-content", enabled: true, settings: {}, blocks });

it("defines a group block that holds content blocks and has the shared style settings", () => {
  const definition = getBlockDefinition("group")!;
  expect(definition.allowedBlockTypes).toEqual(["heading", "text", "button", "image", "video"]);
  expect(definition.maxBlocks).toBe(8);
  expect(definition.controls.map(({ key }) => key)).toEqual(expect.arrayContaining(["groupDirection", "groupGap", "blockBackgroundColor", "blockPaddingTop"]));
});

it("accepts a group of blocks in custom content", () => {
  expect(validateSectionAgainstRegistry(section([group([button("a"), button("b")], { groupDirection: "horizontal", groupGap: 24 })]), "home")).toEqual([]);
});

it("checks the blocks inside a group", () => {
  const codes = (blocks: BlockNode[]) => validateSectionAgainstRegistry(section(blocks), "home").map(({ code, blockId }) => `${code}:${blockId}`);
  // Groups hold no groups, and other blocks hold nothing.
  expect(codes([group([{ ...group([]), id: "inner" }])])).toEqual(["BLOCK_NOT_ALLOWED:inner"]);
  expect(codes([{ ...button("a"), blocks: [button("b")] }])).toEqual(["BLOCK_NOT_ALLOWED:a"]);
  expect(codes([group(Array.from({ length: 9 }, (_, index) => button(`b${index}`)))])).toEqual(["BLOCK_LIMIT_EXCEEDED:g"]);
  expect(codes([group([{ ...button("a"), settings: { label: "Go", buttonSize: "huge" } }])])).toEqual(["SETTINGS_INVALID:a"]);
  expect(codes([group([], { groupDirection: "diagonal" })])).toEqual(["SETTINGS_INVALID:g"]);
});
