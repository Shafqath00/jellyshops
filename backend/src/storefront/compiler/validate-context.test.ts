import { describe, expect, it } from "vitest";
import type { StorefrontCompilationInput } from "./types.js";
import { validateContext } from "./validate-context.js";

function input(): StorefrontCompilationInput {
  return {
    storeId: "store-a",
    generation: 1,
    theme: { presetId: "minimal", settings: {}, artifactId: null },
    templates: [
      {
        id: "home-default",
        type: "home",
        handle: "default",
        name: "Home",
        layout: {
          sections: [{
            kind: "inline",
            section: {
              id: "hero-1",
              type: "hero",
              settings: {
                heading: {
                  kind: "dynamic",
                  binding: { kind: "resource_field", resource: "product", field: "title" },
                },
              },
            },
          }],
        },
      },
    ],
    globalSections: [],
    menus: [],
    assignments: [],
    metafieldDefinitions: [],
    metaobjectDefinitions: [],
    resourceIds: { products: new Set(), collections: new Set(), pages: new Set(), blogs: new Set(), articles: new Set() },
    registryManifestHash: "registry",
  };
}

describe("validateContext", () => {
  it("rejects product-only bindings in a Home template", () => {
    const diagnostics = validateContext(input());
    expect(diagnostics).toEqual([
      expect.objectContaining({
        code: "INVALID_TEMPLATE_CONTEXT",
        location: expect.objectContaining({ entityId: "home-default", sectionId: "hero-1", fieldKey: "heading" }),
      }),
    ]);
  });
});
