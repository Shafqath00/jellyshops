import {
  dynamicValueTypeSchema,
  metafieldDefinitionSchema,
  metaobjectDefinitionSchema,
  type CustomDataOwnerType,
  type DynamicValueType,
  type MetaobjectFieldDefinitionContract,
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

function validateMetaobjectValues(
  fields: MetaobjectFieldDefinitionContract[],
  values: Record<string, unknown>,
): void {
  const byHandle = new Map(fields.map((field) => [field.handle, field]));
  for (const [handle, value] of Object.entries(values)) {
    const field = byHandle.get(handle);
    if (!field) throw new Error(`Unknown metaobject field: ${handle}`);
    if (!isValidCustomDataValue(field.type, value)) {
      throw new Error(`Metaobject field ${handle} must match ${field.type}`);
    }
  }
}

function assertEntryHandle(handle: string): void {
  if (!/^[a-z][a-z0-9-]*$/.test(handle)) {
    throw new Error("Metaobject entry handle must be lowercase letters, numbers, and hyphens");
  }
}

export class MetaobjectService {
  constructor(private readonly repository: MetaobjectRepository) {}

  async createDefinition(
    storeId: string,
    input: Omit<CreateMetaobjectDefinitionInput, "storeId">,
  ): Promise<MetaobjectDefinitionRecord> {
    const parsed = metaobjectDefinitionSchema.parse(input);
    return this.repository.createMetaobjectDefinition({
      storeId,
      handle: parsed.handle,
      name: parsed.name,
      storefrontVisible: parsed.storefrontVisible,
      fields: parsed.fields,
    });
  }

  listDefinitions(storeId: string) {
    return this.repository.listMetaobjectDefinitions(storeId);
  }

  async updateDefinition(
    storeId: string,
    id: string,
    patch: UpdateMetaobjectDefinitionInput,
  ): Promise<MetaobjectDefinitionRecord> {
    const unsafePatch = patch as UpdateMetaobjectDefinitionInput & Record<string, unknown>;
    if ("handle" in unsafePatch) throw new Error("Metaobject handle is immutable");

    const current = await this.repository.getMetaobjectDefinition(storeId, id);
    if (!current) throw new Error("Metaobject definition was not found");

    if (patch.fields) {
      const parsed = metaobjectDefinitionSchema.parse({
        handle: current.handle,
        name: patch.name ?? current.name,
        storefrontVisible: patch.storefrontVisible ?? current.storefrontVisible,
        fields: patch.fields,
      });
      const incoming = new Map(parsed.fields.map((field) => [field.handle, field]));
      for (const existing of current.fields) {
        const next = incoming.get(existing.handle);
        if (!next) throw new Error(`Metaobject field ${existing.handle} cannot be removed`);
        if (next.type !== existing.type) {
          throw new Error(`Metaobject field ${existing.handle} type is immutable`);
        }
      }
      patch = { ...patch, fields: parsed.fields };
    }

    const updated = await this.repository.updateMetaobjectDefinition(storeId, id, patch);
    if (!updated) throw new Error("Metaobject definition was not found");
    return updated;
  }

  async createEntry(
    storeId: string,
    definitionId: string,
    input: Omit<CreateMetaobjectEntryInput, "storeId" | "definitionId">,
  ): Promise<MetaobjectEntryRecord> {
    assertEntryHandle(input.handle);
    const definition = await this.repository.getMetaobjectDefinition(storeId, definitionId);
    if (!definition) throw new Error("Metaobject definition was not found");
    if (definition.archivedAt) throw new Error("Metaobject definition is archived");
    validateMetaobjectValues(definition.fields, input.values);
    return this.repository.createMetaobjectEntry({
      storeId,
      definitionId,
      handle: input.handle,
      displayName: input.displayName,
      values: input.values,
    });
  }

  async updateEntry(
    storeId: string,
    id: string,
    patch: UpdateMetaobjectEntryInput,
  ): Promise<MetaobjectEntryRecord> {
    const unsafePatch = patch as UpdateMetaobjectEntryInput & Record<string, unknown>;
    if ("handle" in unsafePatch || "definitionId" in unsafePatch) {
      throw new Error("Metaobject entry handle and definition are immutable");
    }
    const current = await this.repository.getMetaobjectEntry(storeId, id);
    if (!current) throw new Error("Metaobject entry was not found");
    if (patch.values) {
      const definition = await this.repository.getMetaobjectDefinition(storeId, current.definitionId);
      if (!definition) throw new Error("Metaobject definition was not found");
      validateMetaobjectValues(definition.fields, patch.values);
    }
    const updated = await this.repository.updateMetaobjectEntry(storeId, id, patch);
    if (!updated) throw new Error("Metaobject entry was not found");
    return updated;
  }

  listEntries(storeId: string, definitionId: string) {
    return this.repository.listMetaobjectEntries(storeId, definitionId);
  }
}
