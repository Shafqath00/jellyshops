import { describe, expect, it } from "vitest";
import type { StorefrontCompilationInput } from "./types.js";
import { buildDependencyGraph } from "./dependency-graph.js";
import { assembleRuntimeSnapshot } from "./snapshot.js";

function input(): StorefrontCompilationInput {
  return {
    storeId: "store-a",
    generation: 7,
    theme: { presetId: "minimal", settings: { radius: 8 }, artifactId: null },
    templates: [{
      id: "product-default",
      type: "product",
      handle: "default",
      name: "Default",
      layout: { sections: [{ kind: "inline", section: {
        id: "title-1",
        type: "product-title",
        settings: { heading: { kind: "dynamic", binding: { kind: "resource_field", resource: "product", field: "title" } } },
      } }] },
    }],
    globalSections: [],
    menus: [],
    assignments: [{ resourceType: "product", resourceId: "product-1", templateId: "product-default" }],
    metafieldDefinitions: [],
    metaobjectDefinitions: [],
    resourceIds: { products: new Set(["product-1"]), collections: new Set(), pages: new Set(), blogs: new Set(), articles: new Set() },
    registryManifestHash: "registry-hash",
  };
}

describe("assembleRuntimeSnapshot", () => {
  it("freezes presentation and binding instructions without embedding live resource values", () => {
    const source = input();
    const snapshot = assembleRuntimeSnapshot(source, buildDependencyGraph(source), "2026-01");

    expect(snapshot).toMatchObject({
      schemaVersion: 4,
      storeId: "store-a",
      sourceGeneration: 7,
      compilerVersion: "2026-01",
      registryManifestHash: "registry-hash",
      templateDefaults: { product: "product-default" },
    });
    expect(snapshot.templates["product-default"].layout).toEqual(source.templates[0].layout);
    expect(JSON.stringify(snapshot)).toContain("resource_field");
    expect(snapshot).not.toHaveProperty("catalog");
  });

  it("preserves section settings and template-owned order on a non-Home template", () => {
    const source = input();
    source.templates = [{
      id: "article-default",
      type: "article",
      handle: "default",
      name: "Article",
      layout: { sections: [
        { kind: "inline", section: { id: "story-first", type: "rich-text", settings: { alignment: "center", tone: "warm" }, blocks: [{ id: "copy-first", type: "text", settings: { text: "First" } }] } },
        { kind: "inline", section: { id: "story-second", type: "rich-text", settings: { alignment: "left" }, blocks: [{ id: "copy-second", type: "text", settings: { text: "Second" } }] } },
      ] },
    }];
    const snapshot = assembleRuntimeSnapshot(source, buildDependencyGraph(source), "2026-01");

    expect(snapshot.templates["article-default"].layout.sections.map((placement) => placement.kind === "inline" ? placement.section.id : "global"))
      .toEqual(["story-first", "story-second"]);
    expect(snapshot.templates["article-default"].layout.sections[0]).toMatchObject({
      kind: "inline",
      section: { type: "rich-text", settings: { alignment: "center", tone: "warm" } },
    });
  });
});
