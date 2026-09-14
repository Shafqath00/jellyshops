import type { WorkspaceTransaction } from "../concurrency.js";

export const templateTypes = [
  "home",
  "product",
  "collection",
  "page",
  "blog",
  "article",
  "search",
  "cart",
] as const;

export type TemplateType = typeof templateTypes[number];
export type TemplateLayout = Record<string, unknown>;

export interface StorefrontTemplateRecord {
  id: string;
  storeId: string;
  revision: number;
  type: TemplateType;
  handle: string;
  name: string;
  layout: TemplateLayout;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTemplateRecordInput {
  storeId: string;
  type: TemplateType;
  handle: string;
  name: string;
  layout: TemplateLayout;
}

export interface UpdateTemplateRecordInput {
  handle?: string;
  name?: string;
  layout?: TemplateLayout;
}

export interface CloneTemplateRecordInput {
  name: string;
  handle: string;
}

export interface TemplateRepository {
  getTemplate(storeId: string, templateId: string): Promise<StorefrontTemplateRecord | null>;
  listTemplates(storeId: string, type?: TemplateType): Promise<StorefrontTemplateRecord[]>;
  createTemplate(
    transaction: WorkspaceTransaction,
    input: CreateTemplateRecordInput,
  ): Promise<StorefrontTemplateRecord>;
  updateTemplate(
    transaction: WorkspaceTransaction,
    storeId: string,
    templateId: string,
    expectedRevision: number,
    patch: UpdateTemplateRecordInput,
  ): Promise<StorefrontTemplateRecord | null>;
  cloneTemplate(
    transaction: WorkspaceTransaction,
    storeId: string,
    sourceTemplateId: string,
    input: CloneTemplateRecordInput,
  ): Promise<StorefrontTemplateRecord | null>;
}
