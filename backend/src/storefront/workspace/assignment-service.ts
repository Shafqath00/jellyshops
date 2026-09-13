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
    const resourceId = input.resourceId.trim();
    const templateId = input.templateId.trim();
    if (!resourceId) throw new Error("Assignment resource id is required");
    if (!templateId) throw new Error("Assignment template id is required");

    const mutation = await this.coordinator.run(storeId, async (transaction) => {
      if (!await this.repository.resourceExists(transaction, storeId, input.resourceType, resourceId)) {
        throw new Error(`${input.resourceType} resource does not belong to this store`);
      }
      const templateType = await this.repository.getTemplateType(transaction, storeId, templateId);
      if (!templateType) throw new Error("Storefront template was not found");
      if (templateType !== input.resourceType) {
        throw new Error(`${input.resourceType} resource requires a ${input.resourceType} template`);
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
}
