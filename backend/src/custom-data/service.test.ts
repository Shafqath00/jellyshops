import { describe, expect, it } from "vitest";
import type { CustomDataRepository } from "./repository.js";
import { CustomDataService } from "./service.js";
import type { MetafieldDefinitionRecord, MetafieldValueRecord } from "./repository.js";

function setup() {
  const definitions = new Map<string, MetafieldDefinitionRecord>();
  const values = new Map<string, MetafieldValueRecord>();
  const repository: CustomDataRepository = {
    createMetafieldDefinition: async (input) => {
      const id = `definition-${definitions.size + 1}`;
      const record = { id, archivedAt: null, createdAt: new Date(0), updatedAt: new Date(0), ...input };
      definitions.set(id, record);
      return record;
    },
    getMetafieldDefinition: async (storeId, id) => {
      const record = definitions.get(id);
      return record?.storeId === storeId ? record : null;
    },
    listMetafieldDefinitions: async (storeId, ownerType) => [...definitions.values()]
      .filter((record) => record.storeId === storeId && record.ownerType === ownerType),
    updateMetafieldDefinition: async (storeId, id, patch) => {
      const current = definitions.get(id);
      if (!current || current.storeId !== storeId) return null;
      const updated = { ...current, ...patch, updatedAt: new Date(1) };
      definitions.set(id, updated);
      return updated;
    },
    setMetafieldValue: async (input) => {
      const key = `${input.storeId}:${input.definitionId}:${input.ownerId}`;
      const record = { id: key, updatedAt: new Date(0), ...input };
      values.set(key, record);
      return record;
    },
    getMetafieldValue: async (storeId, definitionId, ownerId) => values.get(`${storeId}:${definitionId}:${ownerId}`) ?? null,
    ownerExists: async (storeId, ownerType, ownerId) => storeId === "store-a" && (
      (ownerType === "store" && ownerId === "store-a") ||
      (ownerType === "product" && ownerId === "product-a")
    ),
  };
  return { service: new CustomDataService(repository), repository };
}

describe("CustomDataService metafields", () => {
  it("creates a typed definition with stable namespace and key", async () => {
    const { service } = setup();
    const definition = await service.createMetafieldDefinition("store-a", {
      ownerType: "product",
      namespace: "details",
      key: "material",
      name: "Material",
      type: "string",
      storefrontVisible: true,
      origin: "jelly",
    });

    expect(definition).toMatchObject({ storeId: "store-a", namespace: "details", key: "material" });
    await expect(service.updateMetafieldDefinition("store-a", definition.id, {
      namespace: "renamed",
    } as never)).rejects.toThrow(/immutable/i);
  });

  it("validates values against the definition type", async () => {
    const { service } = setup();
    const definition = await service.createMetafieldDefinition("store-a", {
      ownerType: "product",
      namespace: "details",
      key: "servings",
      name: "Servings",
      type: "integer",
      storefrontVisible: true,
      origin: "jelly",
    });

    await expect(service.setMetafieldValue("store-a", definition.id, "product-a", 12))
      .resolves.toMatchObject({ value: 12 });
    await expect(service.setMetafieldValue("store-a", definition.id, "product-a", "twelve"))
      .rejects.toThrow(/integer/i);
  });

  it("rejects owner ids outside the current store", async () => {
    const { service } = setup();
    const definition = await service.createMetafieldDefinition("store-a", {
      ownerType: "product",
      namespace: "details",
      key: "material",
      name: "Material",
      type: "string",
      storefrontVisible: true,
      origin: "jelly",
    });

    await expect(service.setMetafieldValue("store-a", definition.id, "product-b", "Cotton"))
      .rejects.toThrow(/owner/i);
  });

  it("archives definitions instead of mutating their stable identifiers", async () => {
    const { service } = setup();
    const definition = await service.createMetafieldDefinition("store-a", {
      ownerType: "store",
      namespace: "branding",
      key: "tagline",
      name: "Tagline",
      type: "string",
      storefrontVisible: true,
      origin: "jelly",
    });

    const archived = await service.archiveMetafieldDefinition("store-a", definition.id);
    expect(archived.archivedAt).toBeInstanceOf(Date);
    await expect(service.setMetafieldValue("store-a", definition.id, "store-a", "Hello"))
      .rejects.toThrow(/archived/i);
  });
});
