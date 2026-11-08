import { expect, it } from "vitest";
import type { BlockNode, SectionNode } from "@jelly/storefront-schema";
import { allowedChildBlockTypes, getBlockDefinition, validateSectionAgainstRegistry } from "./registry.js";

const button = (id: string): BlockNode => ({ id, type: "button", enabled: true, settings: { label: id, href: "/shop" } });
const group = (children: BlockNode[], settings: Record<string, unknown> = {}): BlockNode => ({ id: "g", type: "group", enabled: true, settings, blocks: children });
const section = (blocks: BlockNode[]): SectionNode => ({ id: "s", type: "custom-content", enabled: true, settings: {}, blocks });

it("defines a group block that holds content blocks and has the shared style settings", () => {
  const definition = getBlockDefinition("group")!;
  expect(definition.allowedBlockTypes).toEqual(["heading", "text", "button", "image", "video", "app", "group"]);
  expect(definition.maxBlocks).toBe(8);
  expect(definition.controls.map(({ key }) => key)).toEqual(expect.arrayContaining(["groupDirection", "groupGap", "blockBackgroundColor", "blockPaddingTop"]));
});

it("accepts a group of blocks in custom content", () => {
  expect(validateSectionAgainstRegistry(section([group([button("a"), button("b")], { groupDirection: "horizontal", groupGap: 24 })]), "home")).toEqual([]);
});

it("checks the blocks inside a group", () => {
  const codes = (blocks: BlockNode[]) => validateSectionAgainstRegistry(section(blocks), "home").map(({ code, blockId }) => `${code}:${blockId}`);
  // A group may hold a group of plain blocks (three levels), not a third group; other blocks hold nothing.
  expect(codes([group([{ ...group([button("a")]), id: "inner" }])])).toEqual([]);
  expect(codes([group([{ ...group([{ ...group([]), id: "third" }]), id: "inner" }])])).toEqual(["BLOCK_NOT_ALLOWED:third"]);
  expect(codes([{ ...button("a"), blocks: [button("b")] }])).toEqual(["BLOCK_NOT_ALLOWED:a"]);
  expect(codes([group(Array.from({ length: 9 }, (_, index) => button(`b${index}`)))])).toEqual(["BLOCK_LIMIT_EXCEEDED:g"]);
  expect(codes([group([{ ...button("a"), settings: { label: "Go", buttonSize: "huge" } }])])).toEqual(["SETTINGS_INVALID:a"]);
  expect(codes([group([], { groupDirection: "diagonal" })])).toEqual(["SETTINGS_INVALID:g"]);
});

it("accepts phone values only for phone settings, and checks them", () => {
  const issues = (node: SectionNode) => validateSectionAgainstRegistry(node, "home").map(({ code, blockId, field }) => `${code}:${blockId ?? ""}:${field ?? ""}`);
  const phoneSection = (mobile: Record<string, unknown>, blocks: BlockNode[] = []): SectionNode => ({ ...section(blocks), responsive: { mobile } });
  expect(issues(phoneSection({ stylePaddingTop: 16, styleAlign: "center", gap: 8 }, [{ ...button("a"), responsive: { mobile: { blockPaddingTop: 4 } } }, { id: "h", type: "heading", enabled: true, settings: { text: "Hi" }, responsive: { mobile: { blockTypePreset: "h4" } } }]))).toEqual([]);
  expect(issues(phoneSection({ styleHeadingFont: "Inter" }))).toEqual(["RESPONSIVE_FIELD_NOT_ALLOWED::styleHeadingFont"]);
  expect(issues(phoneSection({ stylePaddingTop: 999 }))).toEqual(["SETTINGS_INVALID::"]);
  expect(issues(section([{ ...button("a"), responsive: { mobile: { label: "Phone label" } } }]))).toEqual(["RESPONSIVE_FIELD_NOT_ALLOWED:a:label"]);
  expect(issues(section([{ ...group([]), responsive: { mobile: { groupDirection: "sideways" } } }]))).toEqual(["SETTINGS_INVALID:g:"]);
});

it("offers groups inside a group only where they can still hold blocks", () => {
  expect(allowedChildBlockTypes("group", 1)).toContain("group");
  expect(allowedChildBlockTypes("group", 2)).toEqual(["heading", "text", "button", "image", "video", "app"]);
  expect(allowedChildBlockTypes("group", 3)).toEqual([]);
  expect(allowedChildBlockTypes("button", 1)).toEqual([]);
});
