import { describe, expect, it } from "vitest";
import { BLOCK_CONTROL_TYPES, SECTION_CONTROL_TYPES } from "./control-types.generated.js";
import { BLOCK_ELEMENTS, SECTION_ELEMENTS } from "./element-data.js";
import { getBlockDefinition, getSectionDefinition, listBlockDefinitions, listSectionDefinitions, sectionLabel } from "./index.js";
import { blockControlTypes, blockElementList, sectionControlTypes, sectionDisplayLabel, sectionElementList } from "./runtime-lookup.js";

/** Store pages answer from generated tables without the definitions; they must match the definitions exactly. */
const SHAPED = ["image", "link", "rich-text", "product", "collection"];
const shaped = (controls: ReadonlyArray<{ key: string; type: string }>) => Object.fromEntries(controls.filter((control) => SHAPED.includes(control.type)).map((control) => [control.key, control.type]));

describe("runtime lookup", () => {
  it("has generated control types that match every built-in section and block (node scripts/generate-control-types.mjs)", () => {
    for (const definition of listSectionDefinitions()) expect(SECTION_CONTROL_TYPES[definition.type] ?? {}, definition.type).toEqual(shaped(definition.controls));
    for (const definition of listBlockDefinitions()) expect(BLOCK_CONTROL_TYPES[definition.type] ?? {}, definition.type).toEqual(shaped(definition.controls));
  });

  it("lists the same parts as the definitions, with or without the registry", () => {
    for (const definition of listSectionDefinitions()) {
      expect(SECTION_ELEMENTS[definition.type] ?? [], definition.type).toEqual(definition.elements ?? []);
      expect(sectionElementList(definition.type)).toEqual(definition.elements ?? []);
    }
    for (const definition of listBlockDefinitions()) {
      expect(BLOCK_ELEMENTS[definition.type] ?? [], definition.type).toEqual(definition.elements ?? []);
      expect(blockElementList(definition.type)).toEqual(definition.elements ?? []);
    }
  });

  it("answers from the full definitions once the registry is loaded", () => {
    expect(sectionDisplayLabel("hero")).toBe(getSectionDefinition("hero")?.label ?? sectionLabel("hero"));
    expect(Object.fromEntries(sectionControlTypes("hero"))).toEqual(Object.fromEntries(getSectionDefinition("hero")!.controls.map((control) => [control.key, control.type])));
    expect(Object.fromEntries(blockControlTypes("image"))).toEqual(Object.fromEntries(getBlockDefinition("image")!.controls.map((control) => [control.key, control.type])));
  });
});
