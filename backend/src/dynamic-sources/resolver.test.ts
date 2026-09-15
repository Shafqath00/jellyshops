import { describe, expect, it } from "vitest";
import type { CatalogProduct } from "../catalog/types.js";
import type { CustomDataRepository, MetaobjectRepository } from "../custom-data/repository.js";
import { DynamicValueResolver, resolveSettingValue } from "./resolver.js";

function product(title: string): CatalogProduct {
  return {
    id: "product-1", storeId: "store-a", externalId: null, handle: "cake", title,
    description: "Cake", vendor: "Jelly", productType: "Dessert", tags: [], status: "ACTIVE",
    media: [], variants: [], priceRange: null, available: true,
  };
}

function data() {
  let material = "Cotton";
  const customData: Pick<CustomDataRepository, "listMetafieldDefinitions" | "getMetafieldValue"> = {
    listMetafieldDefinitions: async (_storeId, ownerType) => ownerType === "product" ? [
      {
        id: "material-def", storeId: "store-a", ownerType: "product", namespace: "details", key: "material",
        name: "Material", type: "string", storefrontVisible: true, origin: "jelly", archivedAt: null,
        createdAt: new Date(0), updatedAt: new Date(0),
      },
      {
        id: "brand-def", storeId: "store-a", ownerType: "product", namespace: "details", key: "brand",
        name: "Brand", type: "metaobject_reference", storefrontVisible: true, origin: "jelly", archivedAt: null,
        validations: { metaobjectDefinitionId: "brand-type" }, createdAt: new Date(0), updatedAt: new Date(0),
      },
    ] : [],
    getMetafieldValue: async (_storeId, definitionId) => ({
      id: `value-${definitionId}`, storeId: "store-a", definitionId, ownerId: "product-1",
      value: definitionId === "material-def" ? material : "brand-entry", updatedAt: new Date(0),
    }),
  };
  const metaobjects: Pick<MetaobjectRepository, "getMetaobjectDefinition" | "getMetaobjectEntry"> = {
    getMetaobjectDefinition: async () => ({
      id: "brand-type", storeId: "store-a", handle: "brand", name: "Brand", storefrontVisible: true,
      fields: [{ handle: "logo", name: "Logo", type: "image", storefrontVisible: true }],
      archivedAt: null, createdAt: new Date(0), updatedAt: new Date(0),
    }),
    getMetaobjectEntry: async () => ({
      id: "brand-entry", storeId: "store-a", definitionId: "brand-type", handle: "jelly", displayName: "Jelly",
      values: { logo: "media-logo" }, archivedAt: null, createdAt: new Date(0), updatedAt: new Date(0),
    }),
  };
  return { customData, metaobjects, setMaterial: (value: string) => { material = value; } };
}

describe("DynamicValueResolver", () => {
  it("reads current resource fields instead of frozen publication values", async () => {
    const { customData, metaobjects } = data();
    const resolver = new DynamicValueResolver(customData, metaobjects);
    const binding = { kind: "resource_field" as const, resource: "product" as const, field: "title" };

    await expect(resolver.resolve("store-a", binding, { product: product("Old title") })).resolves.toBe("Old title");
    await expect(resolver.resolve("store-a", binding, { product: product("New title") })).resolves.toBe("New title");
  });

  it("reads current metafield values without requiring storefront republish", async () => {
    const state = data();
    const resolver = new DynamicValueResolver(state.customData, state.metaobjects);
    const binding = { kind: "metafield" as const, resource: "product" as const, namespace: "details", key: "material" };

    await expect(resolver.resolve("store-a", binding, { product: product("Cake") })).resolves.toBe("Cotton");
    state.setMaterial("Silk");
    await expect(resolver.resolve("store-a", binding, { product: product("Cake") })).resolves.toBe("Silk");
  });

  it("traverses visible metaobject references by stable entry id", async () => {
    const state = data();
    const resolver = new DynamicValueResolver(state.customData, state.metaobjects);
    const binding = {
      kind: "metaobject_field" as const,
      source: { kind: "metafield" as const, resource: "product" as const, namespace: "details", key: "brand" },
      field: "logo",
    };

    await expect(resolver.resolve("store-a", binding, { product: product("Cake") })).resolves.toBe("media-logo");
  });

  it("uses dynamic value, then fallback, then section default, then null", async () => {
    const state = data();
    const resolver = new DynamicValueResolver(state.customData, state.metaobjects);
    const context = { product: product("Cake") };

    await expect(resolveSettingValue(resolver, "store-a", {
      kind: "dynamic", binding: { kind: "resource_field", resource: "product", field: "missing" }, fallback: "Fallback",
    }, context, "Default")).resolves.toBe("Fallback");
    await expect(resolveSettingValue(resolver, "store-a", {
      kind: "dynamic", binding: { kind: "resource_field", resource: "product", field: "missing" },
    }, context, "Default")).resolves.toBe("Default");
    await expect(resolveSettingValue(resolver, "store-a", {
      kind: "dynamic", binding: { kind: "resource_field", resource: "product", field: "missing" },
    }, context)).resolves.toBeNull();
  });
});
