import { describe, expect, it } from "vitest";
import { runtimeStorefrontSnapshotV4Schema } from "./runtime-v4";

function validSnapshot() {
  return {
    schemaVersion: 4,
    storeId: "store-a",
    sourceGeneration: 12,
    compilerVersion: "2026-01",
    registryManifestHash: "registry-sha256",
    theme: {
      presetId: "minimal",
      settings: { colors: { accent: "#ff00aa" } },
      artifactId: null,
    },
    templates: {
      "product-default": {
        id: "product-default",
        type: "product",
        handle: "default",
        layout: {
          sections: [
            {
              kind: "inline",
              section: {
                id: "title-1",
                type: "product-title",
                settings: {
                  heading: {
                    kind: "dynamic",
                    binding: { kind: "resource_field", resource: "product", field: "title" },
                  },
                },
              },
            },
          ],
        },
      },
    },
    globalSections: {},
    menus: {
      main: {
        id: "main",
        handle: "main",
        items: [
          {
            id: "shop",
            label: "Shop",
            target: { kind: "collection", resourceId: "collection-1" },
            children: [],
          },
        ],
      },
    },
    templateDefaults: { product: "product-default" },
    assignments: [
      { resourceType: "product", resourceId: "product-1", templateId: "product-default" },
    ],
    dependencies: {
      edges: [
        {
          from: { type: "template", id: "product-default" },
          to: { type: "metafield_definition", id: "details.material" },
          reason: "binding",
        },
      ],
    },
  };
}

describe("runtime storefront snapshot v4", () => {
  it("accepts immutable presentation configuration and binding instructions", () => {
    const result = runtimeStorefrontSnapshotV4Schema.safeParse(validSnapshot());
    expect(result.success).toBe(true);
  });

  it("rejects unsupported runtime schema versions", () => {
    const result = runtimeStorefrontSnapshotV4Schema.safeParse({ ...validSnapshot(), schemaVersion: 3 });
    expect(result.success).toBe(false);
  });

  it("rejects embedded live commerce values", () => {
    const snapshot = {
      ...validSnapshot(),
      catalog: {
        products: [{ id: "product-1", priceMinor: 1200, inventory: 4 }],
      },
    };
    expect(runtimeStorefrontSnapshotV4Schema.safeParse(snapshot).success).toBe(false);
  });

  it("rejects assignments that point at unsupported resource types", () => {
    const snapshot = validSnapshot();
    snapshot.assignments = [
      { resourceType: "order" as "product", resourceId: "order-1", templateId: "product-default" },
    ];
    expect(runtimeStorefrontSnapshotV4Schema.safeParse(snapshot).success).toBe(false);
  });
});
