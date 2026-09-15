import { describe, expect, it } from "vitest";
import type { CompilerDynamicSourceResolver, CompilerRegistry, StorefrontCompilationInput } from "./types.js";
import { compileStorefront } from "./compiler.js";

function input(): StorefrontCompilationInput {
  return {
    storeId: "store-a",
    generation: 3,
    theme: { presetId: "minimal", settings: {}, artifactId: null },
    templates: [{
      id: "home-default",
      type: "home",
      handle: "default",
      name: "Home",
      layout: { sections: [{ kind: "inline", section: { id: "hero-1", type: "hero", settings: {} } }] },
    }],
    globalSections: [],
    menus: [],
    assignments: [],
    metafieldDefinitions: [],
    metaobjectDefinitions: [],
    resourceIds: { products: new Set(), collections: new Set(), pages: new Set(), blogs: new Set(), articles: new Set() },
    registryManifestHash: "registry",
  };
}

const sources: CompilerDynamicSourceResolver = {
  describeBinding: async () => ({ valueType: "string" }),
};

describe("compileStorefront", () => {
  it("returns no snapshot when a blocking diagnostic exists", async () => {
    const registry: CompilerRegistry = {
      validateSection: () => [{ code: "SECTION_NOT_REGISTERED", message: "Unknown section" }],
      dynamicSettingType: () => null,
    };
    const result = await compileStorefront(input(), registry, sources, "2026-01");

    expect(result.ok).toBe(false);
    expect(result.snapshot).toBeUndefined();
    expect(result.diagnostics.map(({ code }) => code)).toContain("SECTION_NOT_REGISTERED");
  });

  it("returns a validated runtime snapshot when all stages pass", async () => {
    const registry: CompilerRegistry = {
      validateSection: () => [],
      dynamicSettingType: () => null,
    };
    const result = await compileStorefront(input(), registry, sources, "2026-01");

    expect(result.ok).toBe(true);
    expect(result.snapshot).toMatchObject({ schemaVersion: 4, sourceGeneration: 3 });
    expect(result.diagnostics).toEqual([]);
  });
});
