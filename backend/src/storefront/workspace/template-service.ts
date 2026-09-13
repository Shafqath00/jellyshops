import type { WorkspaceMutationRunner } from "./mutation-runner.js";
import type {
  CloneTemplateRecordInput,
  StorefrontTemplateRecord,
  TemplateLayout,
  TemplateRepository,
  TemplateType,
  UpdateTemplateRecordInput,
} from "./repositories/template-repository.js";

export interface CreateTemplateInput {
  type: TemplateType;
  name: string;
  handle?: string;
  layout: TemplateLayout;
}

export interface CloneTemplateInput extends CloneTemplateRecordInput {}

export interface TemplateMutationResult {
  template: StorefrontTemplateRecord;
  generation: number;
}

function normalizeRequiredText(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required`);
  return normalized;
}

function normalizeHandle(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:[-_.][a-z0-9]+)*$/.test(normalized)) {
    throw new Error("Template handle must use lowercase letters, numbers, hyphens, underscores, or dots");
  }
  return normalized;
}

function normalizeLayout(layout: TemplateLayout): TemplateLayout {
  if (!layout || typeof layout !== "object" || Array.isArray(layout)) {
    throw new Error("Template layout must be an object");
  }
  return structuredClone(layout);
}

function requireTemplate(
  template: StorefrontTemplateRecord | null,
): StorefrontTemplateRecord {
  if (!template) throw new Error("Storefront template was not found");
  return template;
}

export class TemplateService {
  constructor(
    private readonly repository: TemplateRepository,
    private readonly coordinator: WorkspaceMutationRunner,
  ) {}

  getTemplate(storeId: string, templateId: string): Promise<StorefrontTemplateRecord | null> {
    return this.repository.getTemplate(storeId, templateId);
  }

  listTemplates(storeId: string, type?: TemplateType): Promise<StorefrontTemplateRecord[]> {
    return this.repository.listTemplates(storeId, type);
  }

  async createTemplate(storeId: string, input: CreateTemplateInput): Promise<TemplateMutationResult> {
    const name = normalizeRequiredText(input.name, "Template name");
    const handle = normalizeHandle(input.handle ?? "default");
    const layout = normalizeLayout(input.layout);

    const mutation = await this.coordinator.run(storeId, (transaction) => this.repository.createTemplate(
      transaction,
      { storeId, type: input.type, name, handle, layout },
    ));
    return { template: mutation.result, generation: mutation.generation };
  }

  async updateTemplate(
    storeId: string,
    templateId: string,
    expectedRevision: number,
    patch: UpdateTemplateRecordInput,
  ): Promise<TemplateMutationResult> {
    const normalizedPatch: UpdateTemplateRecordInput = {
      ...(patch.name !== undefined ? { name: normalizeRequiredText(patch.name, "Template name") } : {}),
      ...(patch.handle !== undefined ? { handle: normalizeHandle(patch.handle) } : {}),
      ...(patch.layout !== undefined ? { layout: normalizeLayout(patch.layout) } : {}),
    };

    const mutation = await this.coordinator.run(storeId, async (transaction) => requireTemplate(
      await this.repository.updateTemplate(
        transaction,
        storeId,
        templateId,
        expectedRevision,
        normalizedPatch,
      ),
    ));
    return { template: mutation.result, generation: mutation.generation };
  }

  async cloneTemplate(
    storeId: string,
    sourceTemplateId: string,
    input: CloneTemplateInput,
  ): Promise<TemplateMutationResult> {
    const cloneInput: CloneTemplateRecordInput = {
      name: normalizeRequiredText(input.name, "Template name"),
      handle: normalizeHandle(input.handle),
    };

    const mutation = await this.coordinator.run(storeId, async (transaction) => requireTemplate(
      await this.repository.cloneTemplate(transaction, storeId, sourceTemplateId, cloneInput),
    ));
    return { template: mutation.result, generation: mutation.generation };
  }
}
