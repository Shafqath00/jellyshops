import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { validateSectionAgainstRegistry } from "@jelly/storefront-registry";
import type { PageType, SectionNode } from "@jelly/storefront-schema";
import { validateThemeManifest } from "./theme-resolver";

/**
 * The example theme in docs/examples/jelly-studio (used by docs/guides/theme-developer-guide.md)
 * is checked against the real manifest schema and section registry, so the guide cannot drift
 * from what the platform accepts.
 */
// Tests run from jellyshops/ (or the repository root).
const exampleDirectory = [resolve(process.cwd(), "../docs/examples/jelly-studio"), resolve(process.cwd(), "docs/examples/jelly-studio")].find((path) => existsSync(path)) ?? "";
const read = (name: string) => JSON.parse(readFileSync(resolve(exampleDirectory, name), "utf8"));
const manifest = read("theme.json");
const starter = read("starter.json") as {
  globalSections: Record<string, SectionNode>;
  templates: Record<string, { type: PageType; sections: Array<{ kind: "inline"; section: SectionNode } | { kind: "global"; globalSectionId: string }> }>;
};

const at = (settings: Record<string, unknown>, path: string) => path.split(".").reduce<unknown>((value, key) => value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined, settings);

describe("docs example theme: Jelly Studio", () => {
  it("has a manifest the platform accepts", () => {
    const parsed = validateThemeManifest(manifest);
    expect(parsed.id).toBe("jelly-studio");
    expect(parsed.assetPrefix).toBe("/themes/jelly-studio/");
  });

  it("gives every setting a default that matches settingsDefaults, with unique ids", () => {
    const ids = new Set<string>();
    for (const setting of manifest.settingsSchema as Array<{ id: string; default: unknown; options?: Array<{ value: string }>; min?: number; max?: number }>) {
      expect(ids.has(setting.id), `duplicate ${setting.id}`).toBe(false);
      ids.add(setting.id);
      expect(at(manifest.settingsDefaults, setting.id), setting.id).toEqual(setting.default);
      if (setting.options) expect(setting.options.map((option) => option.value), setting.id).toContain(setting.default);
      if (setting.min !== undefined && typeof setting.default === "number") expect(setting.default).toBeGreaterThanOrEqual(setting.min);
      if (setting.max !== undefined && typeof setting.default === "number") expect(setting.default).toBeLessThanOrEqual(setting.max);
    }
  });

  it("only uses sections and blocks the registry knows, with valid settings, on pages that allow them", () => {
    for (const [key, template] of Object.entries(starter.templates)) {
      const sections = template.sections.map((placement) => placement.kind === "global" ? starter.globalSections[placement.globalSectionId] : placement.section);
      expect(sections.every(Boolean), `${key} refers to a missing global section`).toBe(true);
      const issues = sections.flatMap((section) => validateSectionAgainstRegistry(section, template.type).map((issue) => `${key}/${section.id}: ${issue.code} ${issue.message}`));
      expect(issues).toEqual([]);
    }
  });

  it("uses unique ids and has a template for each page the guide builds", () => {
    expect(Object.keys(starter.templates).sort()).toEqual(["cart", "collection", "home", "not-found", "page", "product", "search"]);
    const ids = [...Object.values(starter.globalSections).map((section) => section.id), ...Object.values(starter.templates).flatMap((template) => template.sections.flatMap((placement) => placement.kind === "inline" ? [placement.section.id, ...placement.section.blocks.map((block) => block.id)] : []))];
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("starter file schema", () => {
  it("accepts the example starter and refuses structural mistakes", async () => {
    const { starterFileSchema } = await import("./starter-file-schema");
    expect(starterFileSchema.safeParse(starter).success).toBe(true);
    const bad = structuredClone(starter) as unknown as { templates: Record<string, { type: string }> };
    bad.templates.home.type = "homepage";
    expect(starterFileSchema.safeParse(bad).success).toBe(false);
    expect(starterFileSchema.safeParse({ templates: {}, extra: 1 }).success).toBe(false);
  });
});
