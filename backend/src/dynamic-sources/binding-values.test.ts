import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import type { DynamicBinding } from "@jelly/storefront-schema";
import type { AuthProvider } from "../auth/types.js";
import type { CatalogProduct } from "../catalog/types.js";
import type { CustomDataRepository, MetafieldDefinitionRecord, MetaobjectRepository } from "../custom-data/repository.js";
import type { ArticleRecord, PageRecord } from "../content/repository.js";
import { errorHandler } from "../http/errors.js";
import { StorefrontBindingValueService, type BindingValueSources } from "./binding-values.js";
import { createEditorBindingValuesRouter, createPublicBindingValuesRouter } from "./binding-values-routes.js";
import { DynamicValueResolver } from "./resolver.js";

const product = (status: CatalogProduct["status"]): CatalogProduct => ({
  id: "bed-1", storeId: "store-a", externalId: null, handle: "oak-bed", title: "Oak bed", description: "Solid oak",
  vendor: "Jelly", productType: "Bed", tags: [], status, media: [], variants: [], priceRange: null, available: true,
});

const definition = (key: string, type: string, storefrontVisible: boolean, ownerType: "product" | "page" | "store" = "product"): MetafieldDefinitionRecord => ({
  id: `${ownerType}-${key}`, storeId: "store-a", ownerType, namespace: "details", key, name: key, type: type as MetafieldDefinitionRecord["type"],
  storefrontVisible, origin: "jelly", archivedAt: null, createdAt: new Date(0), updatedAt: new Date(0),
});

const stored: Record<string, unknown> = {
  "product-firmness": "Medium firm",
  "product-cost_price": "£120",
  "product-swatch": "media-oak",
  "product-gallery": ["media-oak", "media-missing", "media-ash"],
  "page-intro": "Visit us in Leeds",
  "store-tagline": "Beds made to last",
};

const customData: Pick<CustomDataRepository, "listMetafieldDefinitions" | "getMetafieldValue"> = {
  listMetafieldDefinitions: async (_storeId, ownerType) => ({
    product: [definition("firmness", "string", true), definition("cost_price", "string", false), definition("swatch", "image", true), definition("gallery", "list:image", true)],
    page: [definition("intro", "text", true, "page")],
    store: [definition("tagline", "string", true, "store")],
  } as Record<string, MetafieldDefinitionRecord[]>)[ownerType] ?? [],
  getMetafieldValue: async (_storeId, definitionId, ownerId) => definitionId in stored
    ? { id: `value-${definitionId}`, storeId: "store-a", definitionId, ownerId, value: stored[definitionId], updatedAt: new Date(0) }
    : null,
};
const metaobjects = { getMetaobjectDefinition: async () => null, getMetaobjectEntry: async () => null } as Pick<MetaobjectRepository, "getMetaobjectDefinition" | "getMetaobjectEntry">;

function service(overrides: Partial<BindingValueSources> = {}) {
  const sources: BindingValueSources = {
    product: async () => product("ACTIVE"),
    collection: async () => null,
    page: async () => ({ id: "visit", status: "PUBLISHED", title: "Visit" }) as PageRecord,
    blog: async () => null,
    article: async () => ({ id: "post", status: "DRAFT", blogId: "news", title: "Draft post" }) as ArticleRecord,
    storeName: async () => "Jelly Beds",
    media: async (_storeId, id) => id === "media-missing" ? null : { url: `/api/public/media/store-a/${id}`, alt: id },
    ...overrides,
  };
  return new StorefrontBindingValueService(new DynamicValueResolver(customData, metaobjects), sources);
}

const metafield = (resource: "product" | "page" | "store", key: string): DynamicBinding => ({ kind: "metafield", resource, namespace: "details", key });
const field = (resource: "product" | "store" | "article", name: string): DynamicBinding => ({ kind: "resource_field", resource, field: name });
const values = (results: Array<{ value: unknown }>) => results.map(({ value }) => value);

describe("StorefrontBindingValueService", () => {
  it("returns visible custom fields and resource fields for the product being shown", async () => {
    const results = await service().resolve("store-a", {
      resource: { type: "product", id: "bed-1" },
      bindings: [metafield("product", "firmness"), field("product", "title"), field("store", "name"), metafield("store", "tagline")],
    }, { includeDrafts: false });

    expect(values(results)).toEqual(["Medium firm", "Oak bed", "Jelly Beds", "Beds made to last"]);
  });

  it("never returns custom fields that are not marked visible on the storefront", async () => {
    const results = await service().resolve("store-a", { resource: { type: "product", id: "bed-1" }, bindings: [metafield("product", "cost_price")] }, { includeDrafts: true });
    expect(values(results)).toEqual([null]);
  });

  it("turns image fields into URLs and drops missing images from lists", async () => {
    const results = await service().resolve("store-a", {
      resource: { type: "product", id: "bed-1" },
      bindings: [metafield("product", "swatch"), metafield("product", "gallery")],
    }, { includeDrafts: false });

    expect(values(results)).toEqual([
      { url: "/api/public/media/store-a/media-oak", alt: "media-oak" },
      [{ url: "/api/public/media/store-a/media-oak", alt: "media-oak" }, { url: "/api/public/media/store-a/media-ash", alt: "media-ash" }],
    ]);
  });

  it("hides draft products and posts from shoppers but shows them in the editor preview", async () => {
    const drafts = service({ product: async () => product("DRAFT") });
    const bindings = [field("product", "title")];
    await expect(drafts.resolve("store-a", { resource: { type: "product", id: "bed-1" }, bindings }, { includeDrafts: false }).then(values)).resolves.toEqual([null]);
    await expect(drafts.resolve("store-a", { resource: { type: "product", id: "bed-1" }, bindings }, { includeDrafts: true }).then(values)).resolves.toEqual(["Oak bed"]);
    await expect(service().resolve("store-a", { resource: { type: "article", id: "post" }, bindings: [field("article", "title")] }, { includeDrafts: false }).then(values)).resolves.toEqual([null]);
  });

  it("asks for each binding once and resolves nothing without bindings", async () => {
    const product = vi.fn(async () => null);
    await expect(service({ product }).resolve("store-a", { resource: { type: "product", id: "bed-1" }, bindings: [] }, { includeDrafts: false })).resolves.toEqual([]);
    expect(product).not.toHaveBeenCalled();
    const results = await service().resolve("store-a", { bindings: [field("store", "name"), field("store", "name")] }, { includeDrafts: false });
    expect(results).toHaveLength(1);
  });
});

describe("binding value routes", () => {
  const principal = { userId: 7, storeIds: ["store-a"], storeRoles: { "store-a": "ADMIN" as const } };
  const authProvider: AuthProvider = { verify: async () => principal };

  function app() {
    const resolve = vi.fn(async () => [{ binding: field("store", "name"), value: "Jelly Beds" }]);
    const server = express();
    server.use(express.json());
    server.use("/api/public/stores/:storeId/storefront/binding-values", createPublicBindingValuesRouter({ resolve }));
    server.use("/api/stores/:storeId/storefront", createEditorBindingValuesRouter({ resolve }, authProvider));
    server.use(errorHandler);
    return { server, resolve };
  }

  it("serves shoppers without drafts and the signed-in editor with drafts", async () => {
    const { server, resolve } = app();
    const body = { resource: { type: "product", id: "bed-1" }, bindings: [field("store", "name")] };

    const shopper = await request(server).post("/api/public/stores/store-a/storefront/binding-values").send(body);
    expect(shopper.status).toBe(200);
    expect(shopper.body).toEqual({ values: [{ binding: field("store", "name"), value: "Jelly Beds" }] });
    expect(resolve).toHaveBeenLastCalledWith("store-a", body, { includeDrafts: false });

    const editor = await request(server).post("/api/stores/store-a/storefront/binding-values").set("Authorization", "Bearer token").send(body);
    expect(editor.status).toBe(200);
    expect(resolve).toHaveBeenLastCalledWith("store-a", body, { includeDrafts: true });
  });

  it("rejects malformed bindings and too many of them", async () => {
    const { server, resolve } = app();
    const bad = await request(server).post("/api/public/stores/store-a/storefront/binding-values").send({ bindings: [{ kind: "sql", query: "drop" }] });
    const many = await request(server).post("/api/public/stores/store-a/storefront/binding-values").send({ bindings: Array.from({ length: 61 }, () => field("store", "name")) });
    expect([bad.status, many.status]).toEqual([400, 400]);
    expect(resolve).not.toHaveBeenCalled();
  });

  it("requires a signed-in merchant for the editor version", async () => {
    const { server } = app();
    const response = await request(server).post("/api/stores/store-a/storefront/binding-values").send({ bindings: [] });
    expect(response.status).toBe(401);
  });
});
