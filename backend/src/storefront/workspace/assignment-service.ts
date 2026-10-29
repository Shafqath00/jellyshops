import { ApiError } from "../../http/errors.js";
import type { WorkspaceMutationRunner } from "./mutation-runner.js";
import type {
  AssignableResourceType,
  AssignmentRepository,
  TemplateAssignmentRecord,
  UpsertAssignmentInput,
} from "./repositories/assignment-repository.js";

export interface AssignmentMutationResult {
  assignment: TemplateAssignmentRecord;
  generation: number;
}

export interface AssignmentRemovalResult {
  generation: number;
}

const resourceLabels: Record<AssignableResourceType, string> = {
  product: "product",
  collection: "collection",
  page: "page",
  blog: "blog",
  article: "blog post",
};

function requireResourceId(value: string): string {
  const resourceId = value.trim();
  if (!resourceId) throw new ApiError(400, "ASSIGNMENT_RESOURCE_REQUIRED", "Choose what this template should be used for.");
  return resourceId;
}

export class AssignmentService {
  constructor(
    private readonly repository: AssignmentRepository,
    private readonly coordinator: WorkspaceMutationRunner,
  ) {}

  getAssignment(storeId: string, resourceType: AssignableResourceType, resourceId: string) {
    return this.repository.getAssignment(storeId, resourceType, resourceId);
  }

  async assignTemplate(
    storeId: string,
    input: Omit<UpsertAssignmentInput, "storeId">,
  ): Promise<AssignmentMutationResult> {
    const resourceId = requireResourceId(input.resourceId);
    const templateId = input.templateId.trim();
    if (!templateId) throw new ApiError(400, "ASSIGNMENT_TEMPLATE_REQUIRED", "Choose a template.");
    const label = resourceLabels[input.resourceType];

    const mutation = await this.coordinator.run(storeId, async (transaction) => {
      if (!await this.repository.resourceExists(transaction, storeId, input.resourceType, resourceId)) {
        throw new ApiError(404, "STOREFRONT_RESOURCE_NOT_FOUND", `This ${label} was not found in your store.`);
      }
      const templateType = await this.repository.getTemplateType(transaction, storeId, templateId);
      if (!templateType) throw new ApiError(404, "STOREFRONT_RESOURCE_NOT_FOUND", "Template was not found");
      if (templateType !== input.resourceType) {
        throw new ApiError(400, "TEMPLATE_TYPE_MISMATCH", `A ${label} can only use a ${label} template.`);
      }
      return this.repository.upsertAssignment(transaction, {
        storeId,
        resourceType: input.resourceType,
        resourceId,
        templateId,
        expectedRevision: input.expectedRevision,
      });
    });

    return { assignment: mutation.result, generation: mutation.generation };
  }

  /** Puts the resource back on its page type's default template. */
  async removeAssignment(
    storeId: string,
    input: { resourceType: AssignableResourceType; resourceId: string; expectedRevision: number },
  ): Promise<AssignmentRemovalResult> {
    const resourceId = requireResourceId(input.resourceId);
    const mutation = await this.coordinator.run(storeId, async (transaction) => {
      const removed = await this.repository.deleteAssignment(transaction, {
        storeId,
        resourceType: input.resourceType,
        resourceId,
        expectedRevision: input.expectedRevision,
      });
      if (!removed) throw new ApiError(404, "STOREFRONT_RESOURCE_NOT_FOUND", `This ${resourceLabels[input.resourceType]} already uses the default template.`);
    });
    return { generation: mutation.generation };
  }
}
