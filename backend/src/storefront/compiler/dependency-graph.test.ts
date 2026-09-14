import { describe, expect, it } from "vitest";
import type { StorefrontCompilationInput } from "./types.js";
import { buildDependencyGraph } from "./dependency-graph.js";

function input(): StorefrontCompilationInput {
  return {
    storeId: "store-a",
    generation: 4,
    theme: { presetId: "minimal", settings: {}, artifactId: "artifact-1" },
    templates: [{
      id: "product-default",
      type: "product",
      handle: "default",
      name: "Default",
      layout: {
        sections: [
          { kind: "global", globalSectionId: "shipping-banner" },
          {
            kind: "inline",
            section: {
              id: "details-1",
              type: "product-details",
              settings: {
                material: {
                  kind: "dynamic",
                  binding: { kind: "metafield", resource: "product", namespace: "details", key: "material" },
                },
                brandLogo: {
                  kind: "dynamic",
                  binding: {
                    kind: "metaobject_field",
                    source: { kind: "metafield", resource: "product", namespace: "details", key: "brand" },
                    field: "logo",
                  },
                },
                image: { type: "media", id: "media-1" },
              },
            },
          },
        ],
      },
    }],
    globalSections: [{ id: "shipping-banner", name: "Shipping", section: { id: "banner-1", type: "banner", settings: {} } }],
    menus: [{
      id: "main",
      handle: "main",
      name: "Main",
      items: [{ id: "shop", label: "Shop", target: { kind: "product", resourceId: "product-1" }, children: [] }],
    }],
    assignments: [{ resourceType: "product", resourceId: "product-1", templateId: "product-default" }],
    metafieldDefinitions: [
      { id: "material-def", ownerType: "product", namespace: "details", key: "material", type: "string", storefrontVisible: true, archived: false },
      { id: "brand-def", ownerType: "product", namespace: "details", key: "brand", type: "metaobject_reference", storefrontVisible: true, archived: false, metaobjectDefinitionId: "brand-type" },
    ],
    metaobjectDefinitions: [{
      id: "brand-type",
      handle: "brand",
      storefrontVisible: true,
      archived: false,
      fields: [{ handle: "logo", type: "image", storefrontVisible: true }],
    }],
    resourceIds: { products: new Set(["product-1"]), collections: new Set(), pages: new Set(), blogs: new Set(), articles: new Set() },
    registryManifestHash: "registry",
  };
}

describe("buildDependencyGraph", () => {
  it("records placement, binding, media, navigation, assignment, and extension dependencies", () => {
    const edges = buildDependencyGraph(input()).edges;
    expect(edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ from: { type: "template", id: "product-default" }, to: { type: "global_section", id: "shipping-banner" }, reason: "placement" }),
      expect.objectContaining({ to: { type: "metafield_definition", id: "material-def" }, reason: "binding" }),
      expect.objectContaining({ to: { type: "metaobject_definition", id: "brand-type" }, reason: "binding" }),
      expect.objectContaining({ to: { type: "media", id: "media-1" }, reason: "media" }),
      expect.objectContaining({ from: { type: "menu", id: "main" }, to: { type: "resource", id: "product:product-1" }, reason: "navigation" }),
      expect.objectContaining({ to: { type: "template", id: "product-default" }, reason: "template_assignment" }),
      expect.objectContaining({ from: { type: "theme", id: "active" }, to: { type: "extension", id: "artifact-1" }, reason: "extension" }),
    ]));
  });
});
