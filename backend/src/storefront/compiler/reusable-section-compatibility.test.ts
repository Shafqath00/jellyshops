import { describe, expect, it } from "vitest";
import { validateSectionAgainstRegistry } from "@jelly/storefront-registry";
import type { PageType, SectionNode } from "@jelly/storefront-schema";
import type { CompilerDynamicSourceResolver, CompilerRegistry, StorefrontCompilationInput } from "./types.js";
import { compileStorefront } from "./compiler.js";
import { createPGliteDatabase, seedStore } from "../../../test/integration/pglite.js";
import { SqlCompiledPublicationRepository } from "../publication/sql-repository.js";

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

  it("keeps structured formatting through compilation and local publication storage", async () => {
    const source = input("article");
    const document = { type: "doc", content: [
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Our story", marks: [{ type: "bold" }] }] },
      { type: "paragraph", content: [{ type: "text", text: "Read more", marks: [{ type: "link", attrs: { href: "/pages/about" } }] }] },
    ] };
    const placement = source.templates[0].layout.sections[0];
    if (placement.kind !== "inline") throw new Error("Expected inline rich-text section");
    placement.section.settings.document = document;
    const result = await compileStorefront(source, registry, sources, "2026-01");
    expect(result.ok).toBe(true);
    expect(result.snapshot?.templates["article-default"].layout.sections[0]).toMatchObject({ kind: "inline", section: { settings: { document } } });

    const database = await createPGliteDatabase();
    try {
      await seedStore(database, "store-a", "store-a");
      const publications = new SqlCompiledPublicationRepository(database);
      const saved = await publications.save({ storeId: "store-a", expectedGeneration: 1, idempotencyKey: "rich-text", actorUserId: "user-a", snapshot: result.snapshot!, dependencies: result.dependencies });
      await publications.activate("store-a", saved.id);
      expect((await publications.getCurrent("store-a"))?.snapshot.templates["article-default"].layout.sections[0])
        .toMatchObject({ kind: "inline", section: { settings: { document } } });
    } finally {
      await database.close();
    }
  });

  it("returns compiler diagnostics for unsupported nodes and unsafe links", async () => {
    const source = input("article");
    const placement = source.templates[0].layout.sections[0];
    if (placement.kind !== "inline") throw new Error("Expected inline rich-text section");
    placement.section.settings.document = { type: "doc", content: [{ type: "paragraph", content: [
      { type: "text", text: "Click", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] },
    ] }] };
    const result = await compileStorefront(source, registry, sources, "2026-01");
    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ code: "SETTINGS_INVALID", location: expect.objectContaining({ sectionId: "story-1" }) })]));
  });
});
