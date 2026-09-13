import { describe, expect, it } from "vitest";
import type { CompilerDynamicSourceResolver, CompilerRegistry, StorefrontCompilationInput } from "./types.js";
import { validateBindings } from "./validate-bindings.js";

function input(): StorefrontCompilationInput {
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
        layout: {
          sections: [{
            kind: "inline",
            section: {
              id: "hero-1",
              type: "hero",
              settings: {
                image: {
                  kind: "dynamic",
                  binding: { kind: "resource_field", resource: "product", field: "vendor" },
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

describe("validateBindings", () => {
  it("reports type mismatch at the exact setting", async () => {
    const registry: CompilerRegistry = {
      validateSection: () => [],
      dynamicSettingType: (_sectionType, fieldKey) => fieldKey === "image" ? "image" : null,
    };
    const sources: CompilerDynamicSourceResolver = {
      describeBinding: async () => ({ valueType: "string" }),
    };

    const diagnostics = await validateBindings(input(), registry, sources);
    expect(diagnostics).toEqual([
      expect.objectContaining({
        code: "DYNAMIC_SOURCE_TYPE_MISMATCH",
        location: expect.objectContaining({ entityId: "product-default", sectionId: "hero-1", fieldKey: "image" }),
      }),
    ]);
  });
});
