import type { CustomDataOwnerType, DynamicValueType } from "@jelly/storefront-schema";

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
