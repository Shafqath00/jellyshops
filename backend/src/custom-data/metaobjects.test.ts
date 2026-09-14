import { describe, expect, it } from "vitest";
import type {
  MetaobjectDefinitionRecord,
  MetaobjectEntryRecord,
  MetaobjectRepository,
} from "./repository.js";
import { MetaobjectService } from "./service.js";

function setup() {
  const definitions = new Map<string, MetaobjectDefinitionRecord>();
  const entries = new Map<string, MetaobjectEntryRecord>();
  const repository: MetaobjectRepository = {
    createMetaobjectDefinition: async (input) => {
      const id = `definition-${definitions.size + 1}`;
      const record = { id, archivedAt: null, createdAt: new Date(0), updatedAt: new Date(0), ...input };
      definitions.set(id, record);
      return record;
    },
    getMetaobjectDefinition: async (storeId, id) => {
      const record = definitions.get(id);
      return record?.storeId === storeId ? record : null;
    },
    updateMetaobjectDefinition: async (storeId, id, patch) => {
      const current = definitions.get(id);
      if (!current || current.storeId !== storeId) return null;
      const updated = { ...current, ...patch, updatedAt: new Date(1) };
      definitions.set(id, updated);
      return updated;
    },
    listMetaobjectDefinitions: async (storeId) => [...definitions.values()].filter((item) => item.storeId === storeId),
    createMetaobjectEntry: async (input) => {
      const id = `entry-${entries.size + 1}`;
      const record = { id, archivedAt: null, createdAt: new Date(0), updatedAt: new Date(0), ...input };
      entries.set(id, record);
      return record;
    },
    getMetaobjectEntry: async (storeId, id) => {
      const record = entries.get(id);
      return record?.storeId === storeId ? record : null;
    },
    updateMetaobjectEntry: async (storeId, id, patch) => {
      const current = entries.get(id);
      if (!current || current.storeId !== storeId) return null;
      const updated = { ...current, ...patch, updatedAt: new Date(1) };
      entries.set(id, updated);
      return updated;
    },
    listMetaobjectEntries: async (storeId, definitionId) => [...entries.values()]
      .filter((item) => item.storeId === storeId && item.definitionId === definitionId),
  };
  return new MetaobjectService(repository);
}

describe("MetaobjectService", () => {
  it("validates entry values against the definition field types", async () => {
    const service = setup();
    const definition = await service.createDefinition("store-a", {
      handle: "brand",
      name: "Brand",
      storefrontVisible: true,
      fields: [
        { handle: "name", name: "Name", type: "string", storefrontVisible: true },
        { handle: "logo", name: "Logo", type: "image", storefrontVisible: true },
      ],
    });

    await expect(service.createEntry("store-a", definition.id, {
      handle: "jelly-foods",
      displayName: "Jelly Foods",
      values: { name: "Jelly Foods", logo: "media-1" },
    })).resolves.toMatchObject({ handle: "jelly-foods" });

    await expect(service.createEntry("store-a", definition.id, {
      handle: "broken",
      displayName: "Broken",
      values: { logo: 42 },
    })).rejects.toThrow(/logo/i);
  });

  it("rejects unknown fields in entry values", async () => {
    const service = setup();
    const definition = await service.createDefinition("store-a", {
      handle: "brand",
      name: "Brand",
      storefrontVisible: true,
      fields: [{ handle: "name", name: "Name", type: "string", storefrontVisible: true }],
    });

    await expect(service.createEntry("store-a", definition.id, {
      handle: "jelly-foods",
      displayName: "Jelly Foods",
      values: { unknown: "value" },
    })).rejects.toThrow(/unknown/i);
  });

  it("keeps existing field handles and types stable while allowing labels and new fields", async () => {
    const service = setup();
    const definition = await service.createDefinition("store-a", {
      handle: "brand",
      name: "Brand",
      storefrontVisible: true,
      fields: [{ handle: "name", name: "Name", type: "string", storefrontVisible: true }],
    });

    await expect(service.updateDefinition("store-a", definition.id, {
      name: "Brand profile",
      fields: [
        { handle: "name", name: "Brand name", type: "string", storefrontVisible: true },
        { handle: "logo", name: "Logo", type: "image", storefrontVisible: true },
      ],
    })).resolves.toMatchObject({ name: "Brand profile" });

    await expect(service.updateDefinition("store-a", definition.id, {
      fields: [{ handle: "name", name: "Name", type: "image", storefrontVisible: true }],
    })).rejects.toThrow(/type.*immutable/i);
  });
});
