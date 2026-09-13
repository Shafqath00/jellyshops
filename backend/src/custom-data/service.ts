import {
  dynamicValueTypeSchema,
  metafieldDefinitionSchema,
  type CustomDataOwnerType,
  type DynamicValueType,
} from "@jelly/storefront-schema";
import type {
  CreateMetafieldDefinitionInput,
  CustomDataRepository,
  MetafieldDefinitionRecord,
  MetafieldValueRecord,
  UpdateMetafieldDefinitionInput,
} from "./repository.js";

function validateScalar(type: string, value: unknown): boolean {
  switch (type) {
    case "string":
    case "text":
    case "rich_text":
    case "color":
    case "url":
    case "date":
    case "datetime":
    case "image":
    case "file":
    case "product_reference":
    case "collection_reference":
    case "page_reference":
    case "metaobject_reference":
      return typeof value === "string";
    case "boolean":
      return typeof value === "boolean";
    case "integer":
      return typeof value === "number" && Number.isInteger(value);
    case "decimal":
      return typeof value === "number" && Number.isFinite(value);
    case "money":
      return typeof value === "object" && value !== null
        && Number.isInteger((value as { amountMinor?: unknown }).amountMinor)
        && typeof (value as { currency?: unknown }).currency === "string";
    default:
      return false;
  }
}

export function isValidCustomDataValue(type: DynamicValueType, value: unknown): boolean {
  if (type.startsWith("list:")) {
    if (!Array.isArray(value)) return false;
    const scalar = type.slice(5);
    return value.every((item) => validateScalar(scalar, item));
  }
  return validateScalar(type, value);
}

export class CustomDataService {
  constructor(private readonly repository: CustomDataRepository) {}

  async createMetafieldDefinition(
    storeId: string,
    input: Omit<CreateMetafieldDefinitionInput, "storeId">,
  ): Promise<MetafieldDefinitionRecord> {
    const parsed = metafieldDefinitionSchema.parse(input);
    return this.repository.createMetafieldDefinition({
      storeId,
      ownerType: parsed.ownerType,
      namespace: parsed.namespace,
      key: parsed.key,
      name: parsed.name,
      ...(parsed.description !== undefined ? { description: parsed.description } : {}),
      type: dynamicValueTypeSchema.parse(parsed.type),
      ...(parsed.validations !== undefined ? { validations: parsed.validations } : {}),
      storefrontVisible: parsed.storefrontVisible,
      origin: parsed.origin,
    });
  }

  listMetafieldDefinitions(storeId: string, ownerType: CustomDataOwnerType) {
    return this.repository.listMetafieldDefinitions(storeId, ownerType);
  }

  async updateMetafieldDefinition(
    storeId: string,
    id: string,
    patch: UpdateMetafieldDefinitionInput,
  ): Promise<MetafieldDefinitionRecord> {
    const record = patch as UpdateMetafieldDefinitionInput & Record<string, unknown>;
    for (const immutable of ["namespace", "key", "ownerType", "type"]) {
      if (immutable in record) throw new Error(`Metafield ${immutable} is immutable`);
    }
    const updated = await this.repository.updateMetafieldDefinition(storeId, id, patch);
    if (!updated) throw new Error("Metafield definition was not found");
    return updated;
  }

  async archiveMetafieldDefinition(storeId: string, id: string): Promise<MetafieldDefinitionRecord> {
    return this.updateMetafieldDefinition(storeId, id, { archivedAt: new Date() });
  }

  async setMetafieldValue(
    storeId: string,
    definitionId: string,
    ownerId: string,
    value: unknown,
  ): Promise<MetafieldValueRecord> {
    const definition = await this.repository.getMetafieldDefinition(storeId, definitionId);
    if (!definition) throw new Error("Metafield definition was not found");
    if (definition.archivedAt) throw new Error("Metafield definition is archived");
    if (!isValidCustomDataValue(definition.type, value)) {
      throw new Error(`Metafield value must match ${definition.type}`);
    }
    if (!await this.repository.ownerExists(storeId, definition.ownerType, ownerId)) {
      throw new Error("Metafield owner does not belong to this store");
    }
    return this.repository.setMetafieldValue({ storeId, definitionId, ownerId, value });
  }

  getMetafieldValue(storeId: string, definitionId: string, ownerId: string) {
    return this.repository.getMetafieldValue(storeId, definitionId, ownerId);
  }
}
