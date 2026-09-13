import { Prisma, type PrismaClient } from "../generated/prisma/client.js";
import type { CustomDataOwnerType, DynamicValueType } from "@jelly/storefront-schema";
import type {
  CreateMetafieldDefinitionInput,
  CustomDataRepository,
  MetafieldDefinitionRecord,
  MetafieldValueRecord,
  UpdateMetafieldDefinitionInput,
} from "./repository.js";

function mapDefinition(record: {
  id: string;
  storeId: string;
  ownerType: string;
  namespace: string;
  key: string;
  name: string;
  description: string | null;
  type: string;
  validations: unknown;
  storefrontVisible: boolean;
  origin: string;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): MetafieldDefinitionRecord {
  return {
    id: record.id,
    storeId: record.storeId,
    ownerType: record.ownerType as CustomDataOwnerType,
    namespace: record.namespace,
    key: record.key,
    name: record.name,
    ...(record.description !== null ? { description: record.description } : {}),
    type: record.type as DynamicValueType,
    ...(record.validations && typeof record.validations === "object"
      ? { validations: record.validations as Record<string, unknown> }
      : {}),
    storefrontVisible: record.storefrontVisible,
    origin: record.origin === "provider" ? "provider" : "jelly",
    archivedAt: record.archivedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function mapValue(record: {
  id: string;
  storeId: string;
  definitionId: string;
  ownerId: string;
  value: unknown;
  updatedAt: Date;
}): MetafieldValueRecord {
  return {
    id: record.id,
    storeId: record.storeId,
    definitionId: record.definitionId,
    ownerId: record.ownerId,
    value: record.value,
    updatedAt: record.updatedAt,
  };
}

export class PrismaCustomDataRepository implements CustomDataRepository {
  constructor(private readonly client: PrismaClient) {}

  async createMetafieldDefinition(input: CreateMetafieldDefinitionInput): Promise<MetafieldDefinitionRecord> {
    return mapDefinition(await this.client.metafieldDefinition.create({
      data: {
        ...input,
        ...(input.validations ? { validations: input.validations as Prisma.InputJsonValue } : {}),
      },
    }));
  }

  async getMetafieldDefinition(storeId: string, id: string): Promise<MetafieldDefinitionRecord | null> {
    const record = await this.client.metafieldDefinition.findFirst({ where: { storeId, id } });
    return record ? mapDefinition(record) : null;
  }

  async listMetafieldDefinitions(
    storeId: string,
    ownerType: CustomDataOwnerType,
  ): Promise<MetafieldDefinitionRecord[]> {
    const records = await this.client.metafieldDefinition.findMany({
      where: { storeId, ownerType },
      orderBy: [{ namespace: "asc" }, { key: "asc" }],
    });
    return records.map(mapDefinition);
  }

  async updateMetafieldDefinition(
    storeId: string,
    id: string,
    patch: UpdateMetafieldDefinitionInput,
  ): Promise<MetafieldDefinitionRecord | null> {
    const existing = await this.client.metafieldDefinition.findFirst({ where: { storeId, id } });
    if (!existing) return null;
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

  async setMetafieldValue(
    input: Omit<MetafieldValueRecord, "id" | "updatedAt">,
  ): Promise<MetafieldValueRecord> {
    return mapValue(await this.client.metafieldValue.upsert({
      where: {
        storeId_definitionId_ownerId: {
          storeId: input.storeId,
          definitionId: input.definitionId,
          ownerId: input.ownerId,
        },
      },
      create: {
        ...input,
        value: input.value as Prisma.InputJsonValue,
      },
      update: {
        value: input.value as Prisma.InputJsonValue,
      },
    }));
  }

  async getMetafieldValue(
    storeId: string,
    definitionId: string,
    ownerId: string,
  ): Promise<MetafieldValueRecord | null> {
    const record = await this.client.metafieldValue.findUnique({
      where: { storeId_definitionId_ownerId: { storeId, definitionId, ownerId } },
    });
    return record ? mapValue(record) : null;
  }

  async ownerExists(storeId: string, ownerType: CustomDataOwnerType, ownerId: string): Promise<boolean> {
    switch (ownerType) {
      case "store":
        return (await this.client.store.count({ where: { id: ownerId, archivedAt: null } })) === 1 && ownerId === storeId;
      case "product":
        return (await this.client.product.count({ where: { storeId, id: ownerId } })) === 1;
      case "variant":
        return (await this.client.productVariant.count({ where: { storeId, id: ownerId } })) === 1;
      case "collection":
        return (await this.client.collection.count({ where: { storeId, id: ownerId } })) === 1;
      case "page":
      case "blog":
      case "article":
        return false;
    }
  }
}
