import type { PrismaClient } from "../../../generated/prisma/client.js";
import { ResourceRevisionConflictError } from "../errors.js";
import { nextRevision, type WorkspaceTransaction } from "../concurrency.js";
import type {
  AssignableResourceType,
  AssignmentRepository,
  TemplateAssignmentRecord,
  UpsertAssignmentInput,
} from "./assignment-repository.js";
import type { TemplateType } from "./template-repository.js";

const templateTypes: Record<string, TemplateType> = {
  HOME: "home",
  PRODUCT: "product",
  COLLECTION: "collection",
  PAGE: "page",
  BLOG: "blog",
  ARTICLE: "article",
  SEARCH: "search",
  CART: "cart",
};

function mapAssignment(row: {
  storeId: string;
  resourceType: string;
  resourceId: string;
  revision: number;
  templateId: string;
  updatedAt: Date;
}): TemplateAssignmentRecord {
  return {
    storeId: row.storeId,
    resourceType: row.resourceType as AssignableResourceType,
    resourceId: row.resourceId,
    revision: row.revision,
    templateId: row.templateId,
    updatedAt: row.updatedAt,
  };
}

export class PrismaAssignmentRepository implements AssignmentRepository {
  constructor(private readonly client: PrismaClient) {}

  async getAssignment(
    storeId: string,
    resourceType: AssignableResourceType,
    resourceId: string,
  ): Promise<TemplateAssignmentRecord | null> {
    const row = await this.client.storefrontTemplateAssignment.findUnique({
      where: { storeId_resourceType_resourceId: { storeId, resourceType, resourceId } },
    });
    return row ? mapAssignment(row) : null;
  }

  async getTemplateType(
    transaction: WorkspaceTransaction,
    storeId: string,
    templateId: string,
  ): Promise<TemplateType | null> {
    const template = await transaction.storefrontTemplate.findFirst({
      where: { storeId, id: templateId },
      select: { type: true },
    });
    return template ? templateTypes[template.type] ?? null : null;
  }

  async resourceExists(
    transaction: WorkspaceTransaction,
    storeId: string,
    resourceType: AssignableResourceType,
    resourceId: string,
  ): Promise<boolean> {
    switch (resourceType) {
      case "product": return await transaction.product.count({ where: { storeId, id: resourceId } }) === 1;
      case "collection": return await transaction.collection.count({ where: { storeId, id: resourceId } }) === 1;
      case "page": return await transaction.storePage.count({ where: { storeId, id: resourceId } }) === 1;
      case "blog": return await transaction.blog.count({ where: { storeId, id: resourceId } }) === 1;
      case "article": return await transaction.article.count({ where: { storeId, id: resourceId } }) === 1;
    }
  }

  async upsertAssignment(
    transaction: WorkspaceTransaction,
    input: UpsertAssignmentInput,
  ): Promise<TemplateAssignmentRecord> {
    const key = {
      storeId_resourceType_resourceId: {
        storeId: input.storeId,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
      },
    } as const;
    const current = await transaction.storefrontTemplateAssignment.findUnique({ where: key });

    if (!current) {
      if (input.expectedRevision !== null) {
        throw new ResourceRevisionConflictError(0);
      }
      return mapAssignment(await transaction.storefrontTemplateAssignment.create({
        data: {
          storeId: input.storeId,
          resourceType: input.resourceType,
          resourceId: input.resourceId,
          templateId: input.templateId,
        },
      }));
    }

    if (input.expectedRevision === null || current.revision !== input.expectedRevision) {
      throw new ResourceRevisionConflictError(current.revision);
    }
    return mapAssignment(await transaction.storefrontTemplateAssignment.update({
      where: key,
      data: {
        templateId: input.templateId,
        revision: nextRevision(current.revision),
      },
    }));
  }
}
