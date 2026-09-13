import { describe, expect, it } from "vitest";
import type { CustomDataRepository, MetaobjectRepository } from "../custom-data/repository.js";
import { DynamicSourceRegistry } from "./registry.js";
import { validateDynamicBinding } from "./validator.js";

function repositories() {
  const customData: Pick<CustomDataRepository, "listMetafieldDefinitions"> = {
    listMetafieldDefinitions: async (_storeId, ownerType) => ownerType === "product" ? [
      {
        id: "material-def", storeId: "store-a", ownerType: "product", namespace: "details", key: "material",
        name: "Material", type: "string", storefrontVisible: true, origin: "jelly", archivedAt: null,
        createdAt: new Date(0), updatedAt: new Date(0),
      },
      {
        id: "internal-def", storeId: "store-a", ownerType: "product", namespace: "internal", key: "supplier",
        name: "Supplier", type: "string", storefrontVisible: false, origin: "jelly", archivedAt: null,
        createdAt: new Date(0), updatedAt: new Date(0),
      },
      {
        id: "brand-def", storeId: "store-a", ownerType: "product", namespace: "details", key: "brand",
        name: "Brand", type: "metaobject_reference", storefrontVisible: true, origin: "jelly",
        validations: { metaobjectDefinitionId: "brand-type" }, archivedAt: null,
        createdAt: new Date(0), updatedAt: new Date(0),
      },
    ] : [],
  };
  const metaobjects: Pick<MetaobjectRepository, "getMetaobjectDefinition"> = {
    getMetaobjectDefinition: async (_storeId, id) => id === "brand-type" ? {
      id, storeId: "store-a", handle: "brand", name: "Brand", storefrontVisible: true, archivedAt: null,
      createdAt: new Date(0), updatedAt: new Date(0),
      fields: [
        { handle: "name", name: "Name", type: "string", storefrontVisible: true },
        { handle: "logo", name: "Logo", type: "image", storefrontVisible: true },
        { handle: "secret", name: "Secret", type: "string", storefrontVisible: false },
      ],
    } : null,
  };
  return { customData, metaobjects };
}

describe("dynamic source registry", () => {
  it("lists fixed product fields and only storefront-visible metafields", async () => {
    const { customData, metaobjects } = repositories();
    const registry = new DynamicSourceRegistry(customData, metaobjects);
    const sources = await registry.listDynamicSources("store-a", "product", ["string"]);

    expect(sources.map(({ id }) => id)).toContain("resource:product:title");
    expect(sources.map(({ id }) => id)).toContain("metafield:product:details.material");
    expect(sources.map(({ id }) => id)).not.toContain("metafield:product:internal.supplier");
  });

  it("rejects incompatible source types", async () => {
    const { customData, metaobjects } = repositories();
    const registry = new DynamicSourceRegistry(customData, metaobjects);

    await expect(validateDynamicBinding(registry, "store-a", {
      kind: "resource_field", resource: "product", field: "vendor",
    }, "image", "product")).rejects.toThrow(/image/i);
  });

  it("rejects product-specific sources in home context", async () => {
    const { customData, metaobjects } = repositories();
    const registry = new DynamicSourceRegistry(customData, metaobjects);

    await expect(validateDynamicBinding(registry, "store-a", {
      kind: "resource_field", resource: "product", field: "title",
    }, "string", "home")).rejects.toThrow(/context/i);
  });

  it("resolves visible metaobject fields through a typed metafield reference", async () => {
    const { customData, metaobjects } = repositories();
    const registry = new DynamicSourceRegistry(customData, metaobjects);
    const binding = {
      kind: "metaobject_field" as const,
      source: { kind: "metafield" as const, resource: "product" as const, namespace: "details", key: "brand" },
      field: "logo",
    };

    await expect(validateDynamicBinding(registry, "store-a", binding, "image", "product"))
      .resolves.toMatchObject({ valueType: "image" });
    await expect(validateDynamicBinding(registry, "store-a", { ...binding, field: "secret" }, "string", "product"))
      .rejects.toThrow(/visible/i);
  });
});
