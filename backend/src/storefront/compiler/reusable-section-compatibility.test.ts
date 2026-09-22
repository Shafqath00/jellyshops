import { describe, expect, it } from "vitest";
import { validateSectionAgainstRegistry } from "@jelly/storefront-registry";
import type { PageType, SectionNode } from "@jelly/storefront-schema";
import type { CompilerDynamicSourceResolver, CompilerRegistry, StorefrontCompilationInput } from "./types.js";
import { compileStorefront } from "./compiler.js";

const compatiblePages = ["home", "product", "collection", "page", "blog", "article"] as const;
const sources: CompilerDynamicSourceResolver = { describeBinding: async () => ({ valueType: "string" }) };
const registry: CompilerRegistry = {
  validateSection: (section, templateType) => validateSectionAgainstRegistry(section as SectionNode, templateType as PageType).map((issue) => ({
    code: issue.code,
    message: issue.message,
    sectionId: issue.sectionId,
  })),
  dynamicSettingType: () => null,
};

function input(pageType: typeof compatiblePages[number]): StorefrontCompilationInput {
  return {
    storeId: "store-a",
    generation: 1,
    theme: { presetId: "minimal", settings: {}, artifactId: null },
    templates: [{
      id: `${pageType}-default`,
      type: pageType,
      handle: "default",
      name: `Default ${pageType}`,
      layout: { sections: [{ kind: "inline", section: {
        id: "story-1",
        type: "rich-text",
        settings: { alignment: "center" },
        blocks: [{ id: "copy-1", type: "text", enabled: true, settings: { text: "Independent content" } }],
      } }] },
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

describe("reusable Rich text compiler compatibility", () => {
  it.each(compatiblePages)("compiles Rich text on %s templates", async (pageType) => {
    const result = await compileStorefront(input(pageType), registry, sources, "2026-01");
    expect(result.ok).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.snapshot?.templates[`${pageType}-default`]?.layout.sections[0]).toMatchObject({
      kind: "inline",
      section: { type: "rich-text", settings: { alignment: "center" } },
    });
  });
});
