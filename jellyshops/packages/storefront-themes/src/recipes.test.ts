/* eslint-disable @typescript-eslint/no-explicit-any -- the cases below edit a recipe through loosely typed paths on purpose */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getSectionDefinition, listSectionDefinitionsForPage, sectionLabel, validateSectionAgainstRegistry } from "@jelly/storefront-registry";
import { expandRecipe, getRecipe, recipeSchema, recipesOf, registerRecipes, type SectionRecipe } from "./recipes";
import { validateThemeManifest } from "./theme-resolver";
import { validateThemeProject } from "./validate-theme-project";

const exampleDirectory = [resolve(process.cwd(), "../docs/examples/jelly-studio"), resolve(process.cwd(), "docs/examples/jelly-studio")].find((path) => existsSync(path)) ?? "";
const read = (name: string) => JSON.parse(readFileSync(resolve(exampleDirectory, name), "utf8"));
const recipe = (): SectionRecipe => structuredClone(read("theme.json").sections[0]);
const parse = (value: unknown) => recipeSchema.safeParse(value);
const problems = (value: unknown) => { const result = parse(value); return result.success ? [] : result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`); };

afterEach(() => { registerRecipes("jelly-studio", []); });

describe("section recipes", () => {
  it("accepts the example recipe", () => {
    expect(parse(recipe()).success).toBe(true);
    expect(validateThemeManifest(read("theme.json")).sections).toHaveLength(1);
  });

  it.each([
    ["a setting that is not defined", (r: any) => { r.elements[1].elements[0].text = "{missing}"; }, /not one of this section's settings/],
    ["a setting listed twice", (r: any) => { r.settings.push({ ...r.settings[0] }); }, /listed twice/],
    ["a condition on something that is not a checkbox", (r: any) => { r.elements[1].elements[2].when = "heading"; }, /needs a checkbox/],
    ["an image bound to a text setting", (r: any) => { r.elements[0].image = "{heading}"; }, /needs a image setting/],
    ["an image that is not a single setting", (r: any) => { r.elements[0].image = "https://example.com/a.png"; }, /one image setting/],
    ["an unknown element", (r: any) => { r.elements.push({ kind: "script", text: "x" }); }, /./],
    ["a type that is not theme-id/name", (r: any) => { r.type = "promo"; }, /theme-id\/section-name/],
    ["no elements", (r: any) => { r.elements = []; }, /./],
    ["a group nested too deep", (r: any) => { r.elements = [{ kind: "group", elements: [{ kind: "group", elements: [{ kind: "group", elements: [{ kind: "group", elements: [{ kind: "text", text: "x" }] }] }] }] }]; }, /./],
  ])("refuses %s", (_label, change, message) => {
    const broken = recipe();
    change(broken);
    expect(problems(broken).join("\n")).toMatch(message);
  });

  it("must be named after its own theme in the manifest", () => {
    const manifest = read("theme.json");
    manifest.sections[0].type = "someone-else/promo-banner";
    expect(() => validateThemeManifest(manifest)).toThrow(/jelly-studio\/section-name/);
  });
});

describe("expandRecipe", () => {
  it("uses the defaults, then what the merchant saved, and drops what is switched off or empty", () => {
    const defaults = expandRecipe(recipe(), {});
    expect(defaults.settings).toMatchObject({ direction: "horizontal", contentAlignment: "left", gap: 32, contentWidth: "wide" });
    // No photo chosen yet, so the image is left out; the group holds the heading, text and button.
    expect(defaults.blocks.map((block) => block.type)).toEqual(["group"]);
    const group = defaults.blocks[0];
    expect(group.blocks?.map((block) => [block.type, block.settings.text ?? block.settings.label])).toEqual([["heading", "Free delivery this month"], ["text", "Order before Friday and we cover the postage."], ["button", "Shop now"]]);
    expect(group.blocks?.[2].settings.href).toBe("/search");

    const saved = expandRecipe(recipe(), { heading: "Sale", showButton: false, photo: { url: "https://example.com/p.jpg", alt: "p" } });
    expect(saved.blocks.map((block) => block.type)).toEqual(["image", "group"]);
    expect(saved.blocks[1].blocks?.map((block) => block.type)).toEqual(["heading", "text"]);
    expect(saved.blocks[1].blocks?.[0].settings.text).toBe("Sale");
    expect(saved.blocks[0].settings).toMatchObject({ image: { url: "https://example.com/p.jpg" }, aspectRatio: "landscape" });
  });
  it("gives every generated block its own id", () => {
    const ids: string[] = [];
    const walk = (blocks: Array<{ id: string; blocks?: unknown[] }>) => blocks.forEach((block) => { ids.push(block.id); walk((block.blocks ?? []) as never); });
    walk(expandRecipe(recipe(), { photo: { url: "https://example.com/p.jpg" } }).blocks);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("registering recipes", () => {
  it("adds the section for its theme only, with its settings as editor controls and its own name", () => {
    registerRecipes("jelly-studio", [recipe()]);
    const definition = getSectionDefinition("jelly-studio/promo-banner")!;
    expect(definition.themes).toEqual(["jelly-studio"]);
    expect(definition.controls.map((control) => control.key)).toEqual(expect.arrayContaining(["heading", "body", "showButton", "buttonLabel", "buttonLink", "photo"]));
    expect(definition.defaultSettings).toMatchObject({ heading: "Free delivery this month", showButton: true });
    expect(sectionLabel("jelly-studio/promo-banner")).toBe("Promo banner");
    expect(getRecipe("jelly-studio/promo-banner")?.name).toBe("Promo banner");
    expect(listSectionDefinitionsForPage("home", "template", "jelly-studio").map((entry) => entry.type)).toContain("jelly-studio/promo-banner");
    expect(listSectionDefinitionsForPage("home", "template", "jelly-avenue").map((entry) => entry.type)).not.toContain("jelly-studio/promo-banner");
    const section = (settings: Record<string, unknown>) => ({ id: "s", type: "jelly-studio/promo-banner", enabled: true, settings, blocks: [] });
    expect(validateSectionAgainstRegistry(section({ heading: "Hi" }), "home", "jelly-studio")).toEqual([]);
    expect(validateSectionAgainstRegistry(section({ heading: "x".repeat(301) }), "home", "jelly-studio").map((issue) => issue.code)).toEqual(["SETTINGS_INVALID"]);
    expect(validateSectionAgainstRegistry(section({}), "cart", "jelly-studio").map((issue) => issue.code)).toEqual(["SECTION_NOT_ALLOWED_ON_PAGE"]);
  });
  it("removes sections a newer version of the theme no longer lists, and can be undone", () => {
    registerRecipes("jelly-studio", [recipe()]);
    const undo = registerRecipes("jelly-studio", []);
    expect(getSectionDefinition("jelly-studio/promo-banner")).toBeUndefined();
    undo();
    expect(getSectionDefinition("jelly-studio/promo-banner")).toBeDefined();
  });
  it("is not left behind by validating a theme", () => {
    const manifest = read("theme.json");
    const issues = validateThemeProject({ manifest, starter: read("starter.json"), assetExists: () => true });
    expect(issues.filter((issue) => issue.level === "error")).toEqual([]);
    expect(getSectionDefinition("jelly-studio/promo-banner")).toBeUndefined();
    expect(recipesOf(manifest)).toHaveLength(1);
  });
});
