import { describe, expect, it } from "vitest";
import type { StorefrontCompilationInput } from "./types.js";
import { validateReferences } from "./validate-references.js";

function baseInput(): StorefrontCompilationInput {
  return {
    storeId: "store-a",
    generation: 1,
    theme: { presetId: "minimal", settings: {}, artifactId: null },
    templates: [
      {
        id: "product-default",
        type: "product",
        handle: "default",
        name: "Default",
        layout: { sections: [{ kind: "global", globalSectionId: "missing-global" }] },
      },
    ],
    globalSections: [],
    menus: [
      {
        id: "main",
        handle: "main",
        name: "Main",
        items: [{ id: "shop", label: "Shop", target: { kind: "product", resourceId: "missing-product" }, children: [] }],
      },
    ],
    assignments: [
      { resourceType: "product", resourceId: "product-1", templateId: "missing-template" },
    ],
    metafieldDefinitions: [],
    metaobjectDefinitions: [],
    resourceIds: {
      products: new Set(["product-1"]),
      collections: new Set(),
      pages: new Set(),
      blogs: new Set(),
      articles: new Set(),
    },
    registryManifestHash: "registry",
  };
}

describe("validateReferences", () => {
  it("reports missing global sections, menu targets, and assignment templates", () => {
    const diagnostics = validateReferences(baseInput());
    expect(diagnostics.map(({ code }) => code)).toEqual(expect.arrayContaining([
      "MISSING_GLOBAL_SECTION",
      "BROKEN_RESOURCE_REF",
      "INVALID_TEMPLATE_ASSIGNMENT",
    ]));
  });
});
