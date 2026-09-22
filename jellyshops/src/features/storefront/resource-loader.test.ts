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

function snapshotWithGlobalLayout(): RuntimeStorefrontSnapshotV4 {
  const current = snapshot();
  current.templates.home = {
    id: "home",
    type: "home",
    handle: "default",
    layout: {
      sections: [
        { kind: "global", globalSectionId: "announcement" },
        { kind: "global", globalSectionId: "header" },
        { kind: "inline", section: { id: "home-copy", type: "rich-text", enabled: true, settings: {}, blocks: [] } },
        { kind: "global", globalSectionId: "footer" },
      ],
    },
  };
  current.globalSections = {
    announcement: { id: "announcement", section: { id: "announcement", type: "announcement-bar", enabled: true, settings: {}, blocks: [] } },
    header: { id: "header", section: { id: "header", type: "header", enabled: true, settings: {}, blocks: [] } },
    footer: { id: "footer", section: { id: "footer", type: "footer", enabled: true, settings: {}, blocks: [] } },
  };
  current.templateDefaults = { home: "home", product: "product-default" };
  return current;
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

function collection(overrides: Partial<PublicStorefrontResource> = {}): PublicStorefrontResource {
  return {
    type: "collection",
    id: "collection-1",
    handle: "summer",
    visible: true,
    data: { collection: { id: "collection-1", name: "Summer" }, products: [] },
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
  it("resolves Cart through its default template without a resource assignment", async () => {
    const current = snapshot();
    current.templates["cart-default"] = { id: "cart-default", type: "cart", handle: "default", layout: { sections: [] } };
    current.templateDefaults.cart = "cart-default";

    await expect(resolveStorefrontRoute(current, { type: "cart" }, reader(null)))
      .resolves.toMatchObject({ status: "ready", context: { pageType: "cart", resource: null }, template: { id: "cart-default" } });
  });

  it("resolves Search through its default template without reading a resource", async () => {
    const current = snapshot();
    current.templates["search-default"] = { id: "search-default", type: "search", handle: "default", layout: { sections: [] } };
    current.templateDefaults.search = "search-default";
    const resources = reader(null);

    await expect(resolveStorefrontRoute(current, {
      type: "search",
      context: { type: "search", query: "shoes", state: "results", resultCount: 1, results: [{ id: "shoe", name: "Shoe", href: "/store/products/shoe", imageUrl: "shoe.jpg", price: "$12.00" }] },
    }, resources)).resolves.toMatchObject({ status: "ready", context: { pageType: "search", data: { query: "shoes", resultCount: 1 } }, template: { id: "search-default" } });
    expect(resources.findByHandle).not.toHaveBeenCalled();
  });

  it("resolves home through its default template with named global regions", async () => {
    const result = await resolveStorefrontRoute(snapshotWithGlobalLayout(), { type: "home" }, reader(null));

    expect(result.status).toBe("ready");
    if (result.status !== "ready") throw new Error("expected route to resolve");
    expect(result.context).toEqual({ pageType: "home", resource: null });
    expect(result.layout.announcement.map((section) => section.id)).toEqual(["announcement"]);
    expect(result.layout.header.map((section) => section.id)).toEqual(["header"]);
    expect(result.layout.template.map((section) => section.id)).toEqual(["home-copy"]);
    expect(result.layout.footer.map((section) => section.id)).toEqual(["footer"]);
  });

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

  it("resolves the default Collection template and lets an explicit assignment override it", async () => {
    const current = snapshot();
    current.templates["collection-default"] = { id: "collection-default", type: "collection", handle: "default", layout: { sections: [] } };
    current.templates["collection-featured"] = { id: "collection-featured", type: "collection", handle: "featured", layout: { sections: [] } };
    current.templateDefaults.collection = "collection-default";

    await expect(resolveStorefrontRoute(current, { type: "collection", handle: "summer" }, reader(collection())))
      .resolves.toMatchObject({ status: "ready", template: { id: "collection-default" } });

    current.assignments.push({ resourceType: "collection", resourceId: "collection-1", templateId: "collection-featured" });
    await expect(resolveStorefrontRoute(current, { type: "collection", handle: "summer" }, reader(collection())))
      .resolves.toMatchObject({ status: "ready", template: { id: "collection-featured" } });
  });

  it("resolves the default Article template and lets an explicit assignment override it", async () => {
    const current = snapshot();
    current.templates["article-default"] = { id: "article-default", type: "article", handle: "default", layout: { sections: [] } };
    current.templates["article-featured"] = { id: "article-featured", type: "article", handle: "featured", layout: { sections: [] } };
    current.templateDefaults.article = "article-default";
    const article: PublicStorefrontResource = { type: "article", id: "article-1", handle: "opening", visible: true, data: {} };

    await expect(resolveStorefrontRoute(current, { type: "article", handle: "opening" }, reader(article))).resolves.toMatchObject({ status: "ready", template: { id: "article-default" } });
    current.assignments.push({ resourceType: "article", resourceId: "article-1", templateId: "article-featured" });
    await expect(resolveStorefrontRoute(current, { type: "article", handle: "opening" }, reader(article))).resolves.toMatchObject({ status: "ready", template: { id: "article-featured" } });
  });

  it("falls back to the resource-type default when an assigned template is missing or invalid", async () => {
    const missingAssignment = snapshot();
    missingAssignment.assignments = [{ resourceType: "product", resourceId: "product-1", templateId: "deleted-template" }];

    const missingResult = await resolveStorefrontRoute(
      missingAssignment,
      { type: "product", handle: "classic-cake" },
      reader(product()),
    );

    expect(missingResult).toMatchObject({ status: "ready", template: { id: "product-default" } });

    const invalidAssignment = snapshot();
    invalidAssignment.templates["collection-template"] = {
      id: "collection-template", type: "collection", handle: "default", layout: { sections: [] },
    };
    invalidAssignment.assignments = [{ resourceType: "product", resourceId: "product-1", templateId: "collection-template" }];

    await expect(resolveStorefrontRoute(
      invalidAssignment,
      { type: "product", handle: "classic-cake" },
      reader(product()),
    )).resolves.toMatchObject({ status: "ready", template: { id: "product-default" } });
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
