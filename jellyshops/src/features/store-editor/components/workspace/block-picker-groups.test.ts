import { expect, it } from "vitest";
import { getSectionDefinition } from "@jelly/storefront-registry";
import { blockPickerGroups } from "./editor-inspector-panel";

it("groups Main product's Add block choices: product first, then content, then apps", () => {
  const groups = blockPickerGroups(getSectionDefinition("main-product")!.allowedBlockTypes);
  expect(groups.map(([name]) => name)).toEqual(["Product", "Content", "Apps"]);
  expect(groups[0][1]).toEqual(expect.arrayContaining(["part-product-purchase", "delivery-estimate"]));
  expect(groups[1][1]).toEqual(expect.arrayContaining(["accordion", "notice"]));
  expect(groups[2][1]).toEqual(["app"]);
});

it("keeps a section with one kind of block in a single group", () => {
  expect(blockPickerGroups(getSectionDefinition("faq")!.allowedBlockTypes)).toEqual([["Blocks", ["faq-item"]]]);
});
