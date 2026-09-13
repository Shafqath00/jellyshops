import type { RuntimeStorefrontSnapshotV4 } from "@jelly/storefront-schema";
import { describe, expect, it, vi } from "vitest";
import {
  expandRuntimeTemplate,
  resolvePublicResourceReference,
  resolveStorefrontRoute,
  type PublicResourceReader,
  type PublicStorefrontResource,
} from "./resource-loader";

function snapshot(): RuntimeStorefrontSnapshotV4 {
  return {
    schemaVersion: 4,
    storeId: "store-1",
    sourceGeneration: 7,
    compilerVersion: "2026-09",
    registryManifestHash: "registry-hash",
    theme: { presetId: "minimal", settings: {}, artifactId: null },
    templates: {
      "product-default": {
        id: "product-default",
        type: "product",
        handle: "default",
        layout: { sections: [] },
      },
      "product-featured": {
        id: "product-featured",
        type: "product",
        handle: "featured",
        layout: {
          sections: [
            {
              kind: "inline",
              section: {
                id: "featured-copy",
                type: "rich-text",
                enabled: true,
                settings: { width: "content" },
                blocks: [],
              },
            },
          ],
        },
      },
    },
    globalSections: {},
    menus: {},
    templateDefaults: { product: "product-default" },
    assignments: [
      { resourceType: "product", resourceId: "product-1", templateId: "product-featured" },
    ],
    dependencies: { edges: [] },
  };
}

function product(overrides: Partial<PublicStorefrontResource> = {}): PublicStorefrontResource {
  return {
    type: "product",
    id: "product-1",
    handle: "classic-cake",
    visible: true,
    data: { title: "Classic Cake" },
    ...overrides,
  };
}

function reader(resource: PublicStorefrontResource | null): PublicResourceReader {
  return {
    findByHandle: vi.fn(async () => resource),
    findById: vi.fn(async () => resource),
  };
}

describe("resolveStorefrontRoute", () => {
  it("resolves a handle to a stable resource id before choosing its assigned template", async () => {
    const resources = reader(product());

    const result = await resolveStorefrontRoute(
      snapshot(),
      { type: "product", handle: "classic-cake" },
      resources,
    );

    expect(resources.findByHandle).toHaveBeenCalledWith("product", "classic-cake");
    expect(result.status).toBe("ready");
    if (result.status !== "ready") throw new Error("expected route to resolve");
    expect(result.resource?.id).toBe("product-1");
    expect(result.template.id).toBe("product-featured");
    expect(result.sections[0]?.id).toBe("featured-copy");
  });

  it("keeps the assigned template when a resource handle changes", async () => {
    const resources = reader(product({ handle: "renamed-cake" }));

    const result = await resolveStorefrontRoute(
      snapshot(),
      { type: "product", handle: "renamed-cake" },
      resources,
    );

    expect(result.status).toBe("ready");
    if (result.status !== "ready") throw new Error("expected route to resolve");
    expect(result.template.id).toBe("product-featured");
  });

  it("normalizes omitted enabled flags in compiled section data", () => {
    const current = snapshot();
    const template = current.templates["product-featured"];
    template.layout = {
      sections: [{
        kind: "inline",
        section: {
          id: "copy",
          type: "rich-text",
          settings: {},
          blocks: [{ id: "copy-text", type: "text", settings: { text: "Hello" } }],
        },
      }],
    };

    const sections = expandRuntimeTemplate(current, template);

    expect(sections[0]?.enabled).toBe(true);
    expect(sections[0]?.blocks[0]?.enabled).toBe(true);
  });

  it("returns a safe empty reference for an archived featured resource", async () => {
    const resources = reader(product({ visible: false }));

    await expect(resolvePublicResourceReference(resources, "product", "product-1")).resolves.toBeNull();
  });

  it("returns not-found rather than rendering a hidden route resource", async () => {
    const resources = reader(product({ visible: false }));

    await expect(resolveStorefrontRoute(
      snapshot(),
      { type: "product", handle: "classic-cake" },
      resources,
    )).resolves.toMatchObject({ status: "not-found", reason: "resource" });
  });
});
