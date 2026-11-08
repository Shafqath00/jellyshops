import {
  runtimeStorefrontSnapshotV4Schema,
  type RuntimeStorefrontSnapshotV4,
} from "@jelly/storefront-schema";
import { describe, expect, it } from "vitest";

import {
  resolveStorefrontRoute,
  type PublicResourceReader,
  type PublicStorefrontResource,
  type StorefrontRouteRequest,
} from "./resource-loader";

function publishedSnapshot(): RuntimeStorefrontSnapshotV4 {
  return runtimeStorefrontSnapshotV4Schema.parse({
    schemaVersion: 4,
    storeId: "store-a",
    sourceGeneration: 2,
    compilerVersion: "local-v4-1",
    registryManifestHash: "storefront-registry-0.1.0",
    theme: { presetId: "minimal", settings: {}, artifactId: null },
    templates: {
      "published-home": {
        id: "published-home",
        type: "home",
        handle: "default",
        layout: { sections: [] },
      },
      "published-product": {
        id: "published-product",
        type: "product",
        handle: "default",
        layout: { sections: [] },
      },
      "published-collection": {
        id: "published-collection",
        type: "collection",
        handle: "default",
        layout: { sections: [] },
      },
      "published-cart": {
        id: "published-cart",
        type: "cart",
        handle: "default",
        layout: { sections: [] },
      },
      "published-search": { id: "published-search", type: "search", handle: "default", layout: { sections: [] } },
      "published-page": { id: "published-page", type: "page", handle: "default", layout: { sections: [] } },
      "published-blog": { id: "published-blog", type: "blog", handle: "default", layout: { sections: [] } },
      "published-article": { id: "published-article", type: "article", handle: "default", layout: { sections: [] } },
      "published-not-found": { id: "published-not-found", type: "not-found", handle: "default", layout: { sections: [] } },
    },
    globalSections: {},
    menus: {},
    templateDefaults: {
      home: "published-home",
      product: "published-product",
      collection: "published-collection",
      cart: "published-cart",
      search: "published-search",
      page: "published-page",
      blog: "published-blog",
      article: "published-article",
      "not-found": "published-not-found",
    },
    assignments: [],
    dependencies: { edges: [] },
  });
}

function resourceReader(): PublicResourceReader {
  const resources: PublicStorefrontResource[] = [
    {
      type: "product",
      id: "product-a",
      handle: "product-a",
      visible: true,
      data: { title: "Product A" },
    },
    {
      type: "collection",
      id: "collection-a",
      handle: "collection-a",
      visible: true,
      data: { title: "Collection A", products: [] },
    },
    { type: "page", id: "page-a", handle: "page-a", visible: true, data: { title: "Page A" } },
    { type: "blog", id: "blog-a", handle: "blog-a", visible: true, data: { title: "Blog A" } },
    { type: "article", id: "article-a", handle: "article-a", visible: true, data: { title: "Article A" } },
  ];
  return {
    async findByHandle(type, handle) {
      return resources.find((resource) => resource.type === type && resource.handle === handle) ?? null;
    },
    async findById(type, id) {
      return resources.find((resource) => resource.type === type && resource.id === id) ?? null;
    },
  };
}

describe("published V4 runtime routes", () => {
  it.each([
    [{ type: "home" }, "published-home"],
    [{ type: "product", handle: "product-a" }, "published-product"],
    [{ type: "collection", handle: "collection-a" }, "published-collection"],
    [{ type: "cart" }, "published-cart"],
    [{ type: "search", context: { type: "search", query: "cake", state: "empty", resultCount: 0, results: [] } }, "published-search"],
    [{ type: "page", handle: "page-a" }, "published-page"],
    [{ type: "blog", handle: "blog-a" }, "published-blog"],
    [{ type: "article", handle: "article-a" }, "published-article"],
    [{ type: "not-found" }, "published-not-found"],
  ] as const)("resolves %s through template %s", async (route, templateId) => {
    const result = await resolveStorefrontRoute(
      publishedSnapshot(),
      route as StorefrontRouteRequest,
      resourceReader(),
    );

    expect(result.status).toBe("ready");
    if (result.status !== "ready") throw new Error("expected published route to resolve");
    expect(result.template.id).toBe(templateId);
  });
});
