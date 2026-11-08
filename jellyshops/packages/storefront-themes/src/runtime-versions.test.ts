import { describe, expect, it } from "vitest";
import { getSectionDefinition, listSectionDefinitionsForPage, validateSectionAgainstRegistry } from "@jelly/storefront-registry";
import type { SectionNode } from "@jelly/storefront-schema";
import { registerThemeProject, getStarterPack, listStarterPacks } from "./starter-packs.js";
import { getThemeDefinition, isCompleteStorefrontTheme, listThemes } from "./theme-registry.js";
import { resolveTheme, validateThemeSettings } from "./theme-resolver.js";
import { resolveStorefrontThemeTokens } from "./storefront-theme-tokens.js";
import { getRecipe } from "./recipes.js";
import { validateThemeProject } from "./validate-theme-project.js";

function project(id: string, version: string, full = true) {
  const globalSections: Record<string, SectionNode> = full ? { header: section("header"), footer: section("footer") } : {};
  return {
    manifest: { id, name: `${id} ${version}`, version, description: "version test", assetPrefix: `/themes/${id}/`, layout: "standard", enabled: true,
      settingsDefaults: { copy: version, colors: { primary: version === "1.0.0" ? "#112233" : "#445566" } },
      settingsSchema: [{ id: "copy", type: "select", label: "Copy", default: version, options: [{ value: version, label: version }] }],
      sections: [{ type: `${id}/promo`, name: `Promo ${version}`, supportedPages: ["home"], settings: [{ id: "message", type: "select", label: "Message", default: version, options: [{ value: version, label: version }] }], elements: [{ kind: "heading", text: version }] }],
    },
    starter: { globalSections, templates: { home: { type: "home" as const, sections: [{ kind: "inline" as const, section: section(`${id}/promo`, version) }] } } },
  };
}
const section = (type: string, value = "1.0.0"): SectionNode => ({ id: type, type, enabled: true, settings: { message: value }, blocks: [] });

describe("side-by-side uploaded theme versions", () => {
  it("keeps registered snapshots independent of later edits to the source project", () => {
    const source = project("version-source-copy", "1.0.0");
    registerThemeProject(source);
    source.manifest.settingsDefaults.copy = "Changed";
    source.starter.templates.home.sections[0].section.settings.message = "Changed";
    expect(resolveTheme(source.manifest.id, {}, "1.0.0").settings.copy).toBe("1.0.0");
    const placement = getStarterPack(source.manifest.id, "1.0.0").templates[0].layout.sections[0];
    expect(placement.kind === "inline" && placement.section.settings.message).toBe("1.0.0");
  });
  it.each([false, true])("keeps manifests, defaults, tokens, recipes, controls and starters pinned (reverse=%s)", (reverse) => {
    const id = reverse ? "version-reverse" : "version-forward";
    const entries = [project(id, "1.0.0"), project(id, "2.0.0", false)];
    for (const entry of reverse ? [...entries].reverse() : entries) registerThemeProject(entry);
    for (const version of ["1.0.0", "2.0.0"]) {
      expect(resolveTheme(id, {}, version)).toMatchObject({ id, version, settings: { copy: version } });
      expect(getThemeDefinition(id, version).label).toBe(`${id} ${version}`);
      expect(validateThemeSettings(id, { copy: version }, version)).toEqual([]);
      expect(getRecipe(`${id}/promo`, version)?.name).toBe(`Promo ${version}`);
      expect(getSectionDefinition(`${id}/promo`, version)?.label).toBe(`Promo ${version}`);
      expect(validateSectionAgainstRegistry(section(`${id}/promo`, version), "home", id, version)).toEqual([]);
      expect(getStarterPack(id, version).version).toBe(version);
      expect(isCompleteStorefrontTheme(id, version)).toBe(version === "1.0.0");
      expect(resolveStorefrontThemeTokens(id, {}, {}, version)["--jelly-color-primary"]).toBe(version === "1.0.0" ? "#112233" : "#445566");
    }
    expect(resolveTheme(id).version).toBe("2.0.0");
    expect(listThemes().filter((theme) => theme.id === id)).toHaveLength(1);
    expect(listStarterPacks().filter((pack) => pack.id === id).map((pack) => pack.version)).toEqual(["2.0.0"]);
    expect(resolveTheme(id, {}, "3.0.0")).toMatchObject({ id: "minimal", fallbackReason: "version-unavailable" });
  });

  it("keeps a removed recipe available only on its old version, including during temporary validation", () => {
    const id = "version-removed";
    const old = project(id, "1.0.0"), next = project(id, "2.0.0");
    next.manifest.sections = [];
    next.starter.templates.home.sections = [];
    registerThemeProject(old); registerThemeProject(next);
    expect(getRecipe(`${id}/promo`, "1.0.0")).toBeDefined();
    expect(getRecipe(`${id}/promo`, "2.0.0")).toBeUndefined();
    expect(getSectionDefinition(`${id}/promo`, "2.0.0")).toBeUndefined();
    expect(listSectionDefinitionsForPage("home", "template", id, "2.0.0").some((definition) => definition.type === `${id}/promo`)).toBe(false);
    const edited = project(id, "1.0.0"); edited.manifest.sections[0].name = "Temporary name";
    validateThemeProject(edited);
    expect(getRecipe(`${id}/promo`, "1.0.0")?.name).toBe("Promo 1.0.0");
    expect(getSectionDefinition(`${id}/promo`, "1.0.0")?.label).toBe("Promo 1.0.0");
  });
});
