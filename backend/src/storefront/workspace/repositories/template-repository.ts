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
  "not-found",
  "checkout", "wishlist", "customer-login", "customer-register", "customer-recovery", "customer-account", "customer-orders", "customer-order", "customer-addresses", "order-success",
] as const;

export type TemplateType = typeof templateTypes[number];
export type TemplateLayout = Record<string, unknown>;

/** Handle given to templates set aside when a merchant installs another store design. */
export const RETIRED_TEMPLATE_HANDLE_PREFIX = "previous-";

export function isRetiredTemplateHandle(handle: string): boolean {
  return handle.startsWith(RETIRED_TEMPLATE_HANDLE_PREFIX);
}

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
  countAssignments(
    transaction: WorkspaceTransaction,
    storeId: string,
    templateId: string,
  ): Promise<number>;
  deleteTemplate(
    transaction: WorkspaceTransaction,
    storeId: string,
    templateId: string,
    expectedRevision: number,
  ): Promise<StorefrontTemplateRecord | null>;
}
