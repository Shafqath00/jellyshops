import { describe, expect, it } from "vitest";
import { z } from "zod";
import { storefrontPageTypes, type SectionNode } from "@jelly/storefront-schema";
import { blockSetsIn, breaksSectionLimits, controlConditionMet, expandBlockTypes, isHelpUrl, resolvePlacement, sectionFitsLimit, sectionLimitProblem } from "./composition";
import { defineBlock, defineSection } from "./define";
import { getBlockDefinition, getSectionDefinition, isStaticBlock, listBlockDefinitions, listSectionDefinitionsForPage, pageSectionLimitProblem, registerSection, validateSectionAgainstRegistry } from "./registry";
import type { BlockDefinition, SectionDefinition } from "./types";

const base = (type: string, extra: Partial<SectionDefinition> = {}): SectionDefinition => ({
  type, category: "content", supportedPages: ["home"], settingsSchema: z.object({}).passthrough(),
  controls: [], allowedBlockTypes: [], defaultSettings: {}, defaultBlocks: [], responsiveFields: [], ...extra,
});
const section = (type: string, blocks: SectionNode["blocks"] = [], id = type): SectionNode => ({ id, type, enabled: true, settings: {}, blocks });
const block = (type: string, id = type) => ({ id, type, enabled: true, settings: getBlockDefinition(type)?.defaultSettings ?? {} });

describe("block sets", () => {
  it("puts the general content blocks in @content and app blocks in @app", () => {
    const content = expandBlockTypes(["@content"], listBlockDefinitions());
    expect(content).toEqual(expect.arrayContaining(["heading", "text", "button", "image", "video", "group"]));
    expect(content).not.toContain("app");
    expect(content).not.toContain("slide");
    expect(expandBlockTypes(["@app"], listBlockDefinitions())).toEqual(["app"]);
    expect(expandBlockTypes(["@product"], listBlockDefinitions())).toEqual([]);
  });
  it("keeps named types, expands sets in place and drops repeats", () => {
    const blocks: BlockDefinition[] = [{ type: "a", sets: ["@content"] } as BlockDefinition, { type: "b", sets: ["@content"] } as BlockDefinition];
    expect(expandBlockTypes(["x", "@content", "a"], blocks)).toEqual(["x", "a", "b"]);
    expect(blockSetsIn(["x", "@content", "@app"])).toEqual(["@content", "@app"]);
  });
  it("lets a section accept a set; the registry lists the types and remembers the set", () => {
    registerSection(base("acme/sets", { allowedBlockTypes: ["@content", "@app"], defaultBlocks: [block("heading")] }));
    const definition = getSectionDefinition("acme/sets")!;
    expect(definition.blockSets).toEqual(["@content", "@app"]);
    expect(definition.allowedBlockTypes).toEqual(expect.arrayContaining(["heading", "group", "app"]));
    expect(definition.allowedBlockTypes.some((entry) => entry.startsWith("@"))).toBe(false);
    expect(validateSectionAgainstRegistry(section("acme/sets", [block("text"), block("app")]), "home")).toEqual([]);
    expect(validateSectionAgainstRegistry(section("acme/sets", [block("slide")]), "home").map((issue) => issue.code)).toEqual(["BLOCK_NOT_ALLOWED"]);
  });
  it("leaves the built-in sections' block lists as they were", () => {
    expect(getSectionDefinition("custom-content")!.allowedBlockTypes).toEqual(["heading", "text", "button", "image", "video", "app", "group"]);
    expect(getSectionDefinition("custom-content")!.blockSets).toBeUndefined();
  });
});

describe("placement", () => {
  it("works out pages and groups from enabledOn", () => {
    expect(resolvePlacement({ supportedPages: [], enabledOn: { pages: ["*"], groups: ["template", "footer"] } })).toEqual({ supportedPages: [...storefrontPageTypes], allowedRegions: ["template", "footer"], groups: ["template", "footer"] });
    expect(resolvePlacement({ supportedPages: [], enabledOn: { pages: ["product", "home"] } })).toEqual({ supportedPages: ["home", "product"], allowedRegions: ["template"], groups: ["template"] });
  });
  it("works out pages and groups from disabledOn", () => {
    const placed = resolvePlacement({ supportedPages: [], disabledOn: { pages: ["checkout"], groups: ["header"] } });
    expect(placed.supportedPages).not.toContain("checkout");
    expect(placed.supportedPages).toContain("home");
    expect(placed.allowedRegions).toEqual(["template", "footer"]);
    expect(placed.groups).toEqual(["template", "footer", "overlay"]);
  });
  it("falls back to supportedPages and allowedRegions for older definitions", () => {
    expect(resolvePlacement({ supportedPages: ["cart"], allowedRegions: ["footer"] })).toEqual({ supportedPages: ["cart"], allowedRegions: ["footer"], groups: ["footer"] });
  });
  it("offers a section in the groups enabledOn names", () => {
    registerSection(base("acme/footer-promo", { supportedPages: [], enabledOn: { pages: ["*"], groups: ["footer"] } }));
    expect(listSectionDefinitionsForPage("cart", "footer").map((definition) => definition.type)).toContain("acme/footer-promo");
    expect(listSectionDefinitionsForPage("cart", "template").map((definition) => definition.type)).not.toContain("acme/footer-promo");
    // Built-in sections keep their regions.
    expect(getSectionDefinition("header")!.allowedRegions).toEqual(["header"]);
    expect(getSectionDefinition("hero")!.allowedRegions).toEqual(["template"]);
  });
});

describe("static blocks", () => {
  registerSection(base("acme/split", { staticBlocks: [{ type: "image", label: "Photo" }], allowedBlockTypes: ["heading", "text"], maxBlocks: 1 }));
  it("start in every new section and are recognised by type", () => {
    const definition = getSectionDefinition("acme/split")!;
    expect(definition.defaultBlocks.map((entry) => entry.type)).toEqual(["image"]);
    expect(isStaticBlock("acme/split", "image")).toBe(true);
    expect(isStaticBlock("acme/split", "heading")).toBe(false);
    expect(isStaticBlock("hero", "image")).toBe(false);
  });
  it("are valid even though merchants can't add them, and don't count toward the limit", () => {
    expect(validateSectionAgainstRegistry(section("acme/split", [block("image"), block("heading")]), "home")).toEqual([]);
    expect(validateSectionAgainstRegistry(section("acme/split", [block("heading"), block("text")]), "home").map((issue) => issue.code)).toEqual(["BLOCK_LIMIT_EXCEEDED"]);
  });
  it("appear at most once", () => {
    const issues = validateSectionAgainstRegistry(section("acme/split", [block("image", "a"), block("image", "b")]), "home");
    expect(issues.map((issue) => issue.code)).toEqual(["STATIC_BLOCK_REPEATED"]);
  });
  it("must be registered block types", () => {
    expect(() => registerSection(base("acme/bad-static", { staticBlocks: [{ type: "no-such-block" }] }))).toThrow(/not registered/);
  });
});

describe("section limits", () => {
  const definitionOf = (type: string) => getSectionDefinition(type);
  it("Main product is limited to one per product page", () => {
    expect(getSectionDefinition("main-product")!.limit).toBe(1);
    const one = [section("main-product", [], "a")];
    const two = [...one, section("main-product", [], "b")];
    expect(sectionLimitProblem(one, definitionOf)).toBeNull();
    expect(sectionLimitProblem(two, definitionOf)).toMatch(/only one/);
    expect(pageSectionLimitProblem(one, two)).toMatch(/Product photos and details/);
    expect(sectionFitsLimit("main-product", one, definitionOf)).toBe(false);
    expect(sectionFitsLimit("hero", one, definitionOf)).toBe(true);
  });
  it("only refuses a change that adds a copy past the limit", () => {
    const two = [section("main-product", [], "a"), section("main-product", [], "b")];
    // A page saved with two copies (before limits existed) can still be edited, and can drop one.
    expect(breaksSectionLimits(two, [...two, section("hero")], definitionOf)).toBeNull();
    expect(breaksSectionLimits(two, two.slice(1), definitionOf)).toBeNull();
    expect(breaksSectionLimits(two, [...two, section("main-product", [], "c")], definitionOf)).toMatch(/only one/);
  });
});

describe("conditional settings", () => {
  const values: Record<string, unknown> = { layout: "grid", border: "solid" };
  const valueOf = (key: string) => values[key];
  it("reads showWhen and every visibleIf rule", () => {
    expect(controlConditionMet({}, valueOf)).toBe(true);
    expect(controlConditionMet({ showWhen: { key: "layout", equals: "grid" } }, valueOf)).toBe(true);
    expect(controlConditionMet({ showWhen: { key: "layout", equals: "list" } }, valueOf)).toBe(false);
    expect(controlConditionMet({ visibleIf: { key: "layout", oneOf: ["grid", "bento"] } }, valueOf)).toBe(true);
    expect(controlConditionMet({ visibleIf: { key: "border", notEquals: "none" } }, valueOf)).toBe(true);
    expect(controlConditionMet({ visibleIf: { key: "border", equals: "none" } }, valueOf)).toBe(false);
    // Both rules must hold.
    expect(controlConditionMet({ showWhen: { key: "layout", equals: "grid" }, visibleIf: { key: "border", equals: "none" } }, valueOf)).toBe(false);
  });
});

describe("definition checks", () => {
  it("refuse unknown sets, bad limits, both placements, bad help links and unclear conditions", () => {
    expect(() => defineSection(base("x", { allowedBlockTypes: ["@everything"] }))).toThrow(/not a block set/);
    expect(() => defineSection(base("x", { limit: 3 as never }))).toThrow(/use 1 or 2/);
    expect(() => defineSection(base("x", { enabledOn: { pages: ["home"] }, disabledOn: { pages: ["cart"] } }))).toThrow(/both/);
    expect(() => defineSection(base("x", { helpUrl: "javascript:alert(1)" }))).toThrow(/help link/);
    expect(() => defineSection(base("x", { staticBlocks: [{ type: "image" }, { type: "image" }] }))).toThrow(/twice/);
    expect(() => defineSection(base("x", { controls: [{ type: "checkbox", key: "a", label: "A", group: "content", visibleIf: { key: "b", equals: 1, notEquals: 2 } }] }))).toThrow(/exactly one/);
    expect(() => defineBlock({ type: "y", settingsSchema: z.object({}), controls: [], defaultSettings: {}, sets: ["@nope" as never] })).toThrow(/not a block set/);
    expect(defineSection(base("x", { helpUrl: "/help/custom-section", limit: 2 })).limit).toBe(2);
  });
  it("accept help links under /help/ or on https", () => {
    expect(isHelpUrl("/help/custom-section")).toBe(true);
    expect(isHelpUrl("https://help.example.com/sections")).toBe(true);
    expect(isHelpUrl("http://example.com")).toBe(false);
    expect(isHelpUrl("/admin")).toBe(false);
  });
});
