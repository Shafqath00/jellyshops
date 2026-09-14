import type { WorkspaceTransaction } from "../concurrency.js";
import type { TemplateType } from "./template-repository.js";

export type AssignableResourceType = "product" | "collection" | "page" | "blog" | "article";

export interface TemplateAssignmentRecord {
  storeId: string;
  resourceType: AssignableResourceType;
  resourceId: string;
  revision: number;
  templateId: string;
  updatedAt: Date;
}

export interface UpsertAssignmentInput {
  storeId: string;
  resourceType: AssignableResourceType;
  resourceId: string;
  templateId: string;
  expectedRevision: number | null;
}

export interface AssignmentRepository {
  getAssignment(
    storeId: string,
    resourceType: AssignableResourceType,
    resourceId: string,
  ): Promise<TemplateAssignmentRecord | null>;
  getTemplateType(
    transaction: WorkspaceTransaction,
    storeId: string,
    templateId: string,
  ): Promise<TemplateType | null>;
  resourceExists(
    transaction: WorkspaceTransaction,
    storeId: string,
    resourceType: AssignableResourceType,
    resourceId: string,
  ): Promise<boolean>;
  upsertAssignment(
    transaction: WorkspaceTransaction,
    input: UpsertAssignmentInput,
  ): Promise<TemplateAssignmentRecord>;
}
