import { Prisma, type PrismaClient } from "../generated/prisma/client.js";
import type {
  CustomDataOwnerType,
  DynamicValueType,
  MetaobjectFieldDefinitionContract,
} from "@jelly/storefront-schema";
import type {
  CreateMetafieldDefinitionInput,
  CreateMetaobjectDefinitionInput,
  CreateMetaobjectEntryInput,
  CustomDataRepository,
  MetafieldDefinitionRecord,
  MetafieldValueRecord,
  MetaobjectDefinitionRecord,
  MetaobjectEntryRecord,
  MetaobjectRepository,
  UpdateMetafieldDefinitionInput,
  UpdateMetaobjectDefinitionInput,
  UpdateMetaobjectEntryInput,
} from "./repository.js";

function mapDefinition(record: any): MetafieldDefinitionRecord {
  return {
    id: record.id,
    storeId: record.storeId,
    ownerType: record.ownerType as CustomDataOwnerType,
    namespace: record.namespace,
    key: record.key,
    name: record.name,
    ...(record.description !== null ? { description: record.description } : {}),
    type: record.type as DynamicValueType,
    ...(record.validations && typeof record.validations === "object" ? { validations: record.validations } : {}),
    storefrontVisible: record.storefrontVisible,
    origin: record.origin === "provider" ? "provider" : "jelly",
    archivedAt: record.archivedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function mapValue(record: any): MetafieldValueRecord {
  return { ...record, value: record.value };
}

function mapMetaobjectDefinition(record: any): MetaobjectDefinitionRecord {
  return {
    id: record.id,
    storeId: record.storeId,
    handle: record.handle,
    name: record.name,
    storefrontVisible: record.storefrontVisible,
    fields: record.fields as MetaobjectFieldDefinitionContract[],
    archivedAt: record.archivedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function mapMetaobjectEntry(record: any): MetaobjectEntryRecord {
  return {
    id: record.id,
    storeId: record.storeId,
    definitionId: record.definitionId,
    handle: record.handle,
    displayName: record.displayName,
    values: record.values as Record<string, unknown>,
    archivedAt: record.archivedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export class PrismaCustomDataRepository implements CustomDataRepository, MetaobjectRepository {
  constructor(private readonly client: PrismaClient) {}

  async createMetafieldDefinition(input: CreateMetafieldDefinitionInput): Promise<MetafieldDefinitionRecord> {
    return mapDefinition(await this.client.metafieldDefinition.create({
      data: { ...input, ...(input.validations ? { validations: input.validations as Prisma.InputJsonValue } : {}) },
    }));
  }

  async getMetafieldDefinition(storeId: string, id: string): Promise<MetafieldDefinitionRecord | null> {
    const record = await this.client.metafieldDefinition.findFirst({ where: { storeId, id } });
    return record ? mapDefinition(record) : null;
  }

  async listMetafieldDefinitions(storeId: string, ownerType: CustomDataOwnerType): Promise<MetafieldDefinitionRecord[]> {
    return (await this.client.metafieldDefinition.findMany({
      where: { storeId, ownerType }, orderBy: [{ namespace: "asc" }, { key: "asc" }],
    })).map(mapDefinition);
  }

  async updateMetafieldDefinition(storeId: string, id: string, patch: UpdateMetafieldDefinitionInput): Promise<MetafieldDefinitionRecord | null> {
    if (!await this.client.metafieldDefinition.findFirst({ where: { storeId, id } })) return null;
    return mapDefinition(await this.client.metafieldDefinition.update({
      where: { id },
      data: {
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.validations !== undefined ? { validations: patch.validations as Prisma.InputJsonValue } : {}),
        ...(patch.storefrontVisible !== undefined ? { storefrontVisible: patch.storefrontVisible } : {}),
        ...(patch.archivedAt !== undefined ? { archivedAt: patch.archivedAt } : {}),
      },
    }));
  }

  async setMetafieldValue(input: Omit<MetafieldValueRecord, "id" | "updatedAt">): Promise<MetafieldValueRecord> {
    return mapValue(await this.client.metafieldValue.upsert({
      where: { storeId_definitionId_ownerId: { storeId: input.storeId, definitionId: input.definitionId, ownerId: input.ownerId } },
      create: { ...input, value: input.value as Prisma.InputJsonValue },
      update: { value: input.value as Prisma.InputJsonValue },
    }));
  }

  async getMetafieldValue(storeId: string, definitionId: string, ownerId: string): Promise<MetafieldValueRecord | null> {
    const record = await this.client.metafieldValue.findUnique({
      where: { storeId_definitionId_ownerId: { storeId, definitionId, ownerId } },
    });
    return record ? mapValue(record) : null;
  }

  async ownerExists(storeId: string, ownerType: CustomDataOwnerType, ownerId: string): Promise<boolean> {
    switch (ownerType) {
      case "store": return ownerId === storeId && await this.client.store.count({ where: { id: storeId, archivedAt: null } }) === 1;
      case "product": return await this.client.product.count({ where: { storeId, id: ownerId } }) === 1;
      case "variant": return await this.client.productVariant.count({ where: { storeId, id: ownerId } }) === 1;
      case "collection": return await this.client.collection.count({ where: { storeId, id: ownerId } }) === 1;
      case "page":
      case "blog":
      case "article": return false;
    }
  }

  async createMetaobjectDefinition(input: CreateMetaobjectDefinitionInput): Promise<MetaobjectDefinitionRecord> {
    return mapMetaobjectDefinition(await this.client.metaobjectDefinition.create({
      data: { ...input, fields: input.fields as unknown as Prisma.InputJsonValue },
    }));
  }

  async getMetaobjectDefinition(storeId: string, id: string): Promise<MetaobjectDefinitionRecord | null> {
    const record = await this.client.metaobjectDefinition.findFirst({ where: { storeId, id } });
    return record ? mapMetaobjectDefinition(record) : null;
  }

  async updateMetaobjectDefinition(storeId: string, id: string, patch: UpdateMetaobjectDefinitionInput): Promise<MetaobjectDefinitionRecord | null> {
    if (!await this.client.metaobjectDefinition.findFirst({ where: { storeId, id } })) return null;
    return mapMetaobjectDefinition(await this.client.metaobjectDefinition.update({
      where: { id },
      data: {
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.storefrontVisible !== undefined ? { storefrontVisible: patch.storefrontVisible } : {}),
        ...(patch.fields !== undefined ? { fields: patch.fields as unknown as Prisma.InputJsonValue } : {}),
        ...(patch.archivedAt !== undefined ? { archivedAt: patch.archivedAt } : {}),
      },
    }));
  }

  async listMetaobjectDefinitions(storeId: string): Promise<MetaobjectDefinitionRecord[]> {
    return (await this.client.metaobjectDefinition.findMany({ where: { storeId }, orderBy: { handle: "asc" } })).map(mapMetaobjectDefinition);
  }

  async createMetaobjectEntry(input: CreateMetaobjectEntryInput): Promise<MetaobjectEntryRecord> {
    return mapMetaobjectEntry(await this.client.metaobjectEntry.create({
      data: { ...input, values: input.values as Prisma.InputJsonValue },
    }));
  }

  async getMetaobjectEntry(storeId: string, id: string): Promise<MetaobjectEntryRecord | null> {
    const record = await this.client.metaobjectEntry.findFirst({ where: { storeId, id } });
    return record ? mapMetaobjectEntry(record) : null;
  }

  async updateMetaobjectEntry(storeId: string, id: string, patch: UpdateMetaobjectEntryInput): Promise<MetaobjectEntryRecord | null> {
    if (!await this.client.metaobjectEntry.findFirst({ where: { storeId, id } })) return null;
    return mapMetaobjectEntry(await this.client.metaobjectEntry.update({
      where: { id },
      data: {
        ...(patch.displayName !== undefined ? { displayName: patch.displayName } : {}),
        ...(patch.values !== undefined ? { values: patch.values as Prisma.InputJsonValue } : {}),
        ...(patch.archivedAt !== undefined ? { archivedAt: patch.archivedAt } : {}),
      },
    }));
  }

  async listMetaobjectEntries(storeId: string, definitionId: string): Promise<MetaobjectEntryRecord[]> {
    return (await this.client.metaobjectEntry.findMany({
      where: { storeId, definitionId }, orderBy: { handle: "asc" },
    })).map(mapMetaobjectEntry);
  }
}
