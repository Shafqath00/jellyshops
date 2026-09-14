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
});
