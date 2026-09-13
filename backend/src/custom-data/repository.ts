import type {
  CustomDataOwnerType,
  DynamicValueType,
  MetaobjectFieldDefinitionContract,
} from "@jelly/storefront-schema";

export interface MetafieldDefinitionRecord {
  id: string;
  storeId: string;
  ownerType: CustomDataOwnerType;
  namespace: string;
  key: string;
  name: string;
  description?: string;
  type: DynamicValueType;
  validations?: Record<string, unknown>;
  storefrontVisible: boolean;
  origin: "jelly" | "provider";
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateMetafieldDefinitionInput = Omit<
  MetafieldDefinitionRecord,
  "id" | "archivedAt" | "createdAt" | "updatedAt"
>;

export interface UpdateMetafieldDefinitionInput {
  name?: string;
  description?: string;
  validations?: Record<string, unknown>;
  storefrontVisible?: boolean;
  archivedAt?: Date | null;
}

export interface MetafieldValueRecord {
  id: string;
  storeId: string;
  definitionId: string;
  ownerId: string;
  value: unknown;
  updatedAt: Date;
}

export interface CustomDataRepository {
  createMetafieldDefinition(input: CreateMetafieldDefinitionInput): Promise<MetafieldDefinitionRecord>;
  getMetafieldDefinition(storeId: string, id: string): Promise<MetafieldDefinitionRecord | null>;
  listMetafieldDefinitions(storeId: string, ownerType: CustomDataOwnerType): Promise<MetafieldDefinitionRecord[]>;
  updateMetafieldDefinition(
    storeId: string,
    id: string,
    patch: UpdateMetafieldDefinitionInput,
  ): Promise<MetafieldDefinitionRecord | null>;
  setMetafieldValue(input: Omit<MetafieldValueRecord, "id" | "updatedAt">): Promise<MetafieldValueRecord>;
  getMetafieldValue(storeId: string, definitionId: string, ownerId: string): Promise<MetafieldValueRecord | null>;
  ownerExists(storeId: string, ownerType: CustomDataOwnerType, ownerId: string): Promise<boolean>;
}

export interface MetaobjectDefinitionRecord {
  id: string;
  storeId: string;
  handle: string;
  name: string;
  storefrontVisible: boolean;
  fields: MetaobjectFieldDefinitionContract[];
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateMetaobjectDefinitionInput = Omit<
  MetaobjectDefinitionRecord,
  "id" | "archivedAt" | "createdAt" | "updatedAt"
>;

export interface UpdateMetaobjectDefinitionInput {
  name?: string;
  storefrontVisible?: boolean;
  fields?: MetaobjectFieldDefinitionContract[];
  archivedAt?: Date | null;
}

export interface MetaobjectEntryRecord {
  id: string;
  storeId: string;
  definitionId: string;
  handle: string;
  displayName: string;
  values: Record<string, unknown>;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateMetaobjectEntryInput = Omit<
  MetaobjectEntryRecord,
  "id" | "archivedAt" | "createdAt" | "updatedAt"
>;

export interface UpdateMetaobjectEntryInput {
  displayName?: string;
  values?: Record<string, unknown>;
  archivedAt?: Date | null;
}

export interface MetaobjectRepository {
  createMetaobjectDefinition(input: CreateMetaobjectDefinitionInput): Promise<MetaobjectDefinitionRecord>;
  getMetaobjectDefinition(storeId: string, id: string): Promise<MetaobjectDefinitionRecord | null>;
  updateMetaobjectDefinition(
    storeId: string,
    id: string,
    patch: UpdateMetaobjectDefinitionInput,
  ): Promise<MetaobjectDefinitionRecord | null>;
  listMetaobjectDefinitions(storeId: string): Promise<MetaobjectDefinitionRecord[]>;
  createMetaobjectEntry(input: CreateMetaobjectEntryInput): Promise<MetaobjectEntryRecord>;
  getMetaobjectEntry(storeId: string, id: string): Promise<MetaobjectEntryRecord | null>;
  updateMetaobjectEntry(
    storeId: string,
    id: string,
    patch: UpdateMetaobjectEntryInput,
  ): Promise<MetaobjectEntryRecord | null>;
  listMetaobjectEntries(storeId: string, definitionId: string): Promise<MetaobjectEntryRecord[]>;
}
