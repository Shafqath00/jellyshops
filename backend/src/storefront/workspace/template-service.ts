import { ApiError } from "../../http/errors.js";
import type { WorkspaceMutationRunner } from "./mutation-runner.js";
import {
  isRetiredTemplateHandle,
  type CloneTemplateRecordInput,
  type StorefrontTemplateRecord,
  type TemplateLayout,
  type TemplateRepository,
  type TemplateType,
  type UpdateTemplateRecordInput,
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

export interface TemplateDeletionResult {
  templateId: string;
  generation: number;
}

function normalizeName(value: string): string {
  const normalized = value.trim();
  if (!normalized) throw new ApiError(400, "TEMPLATE_NAME_REQUIRED", "Give the template a name.");
  return normalized;
}

function normalizeHandle(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:[-_.][a-z0-9]+)*$/.test(normalized)) {
    throw new ApiError(400, "TEMPLATE_HANDLE_INVALID", "Template handles can only use lowercase letters, numbers, hyphens, underscores or dots.");
  }
  if (isRetiredTemplateHandle(normalized)) {
    throw new ApiError(400, "TEMPLATE_HANDLE_RESERVED", "Template handles can't start with \"previous-\". Choose another name.");
  }
  return normalized;
}

/** Checks the placement shape only; section types and settings are checked when the store is published. */
function normalizeLayout(layout: TemplateLayout): TemplateLayout {
  const issues: Array<{ path: string; message: string }> = [];
  if (!layout || typeof layout !== "object" || Array.isArray(layout)) {
    issues.push({ path: "layout", message: "Layout must be an object" });
  } else if (!Array.isArray(layout.sections)) {
    issues.push({ path: "layout.sections", message: "Layout must list its sections" });
  } else {
    const sectionIds = new Set<string>();
    layout.sections.forEach((placement: unknown, index) => {
      const path = `layout.sections.${index}`;
      const record = placement && typeof placement === "object" && !Array.isArray(placement) ? placement as Record<string, unknown> : null;
      if (record?.kind === "global") {
        if (typeof record.globalSectionId !== "string" || !record.globalSectionId) issues.push({ path, message: "Shared section placement needs a section id" });
        return;
      }
      const section = record?.kind === "inline" && record.section && typeof record.section === "object" && !Array.isArray(record.section)
        ? record.section as Record<string, unknown>
        : null;
      if (!section) { issues.push({ path, message: "Each placement must be an inline section or a shared section" }); return; }
      if (typeof section.id !== "string" || !section.id) issues.push({ path: `${path}.section.id`, message: "Section needs an id" });
      else if (sectionIds.has(section.id)) issues.push({ path: `${path}.section.id`, message: "Section ids must be unique in a template" });
      else sectionIds.add(section.id);
      if (typeof section.type !== "string" || !section.type) issues.push({ path: `${path}.section.type`, message: "Section needs a type" });
      if (section.blocks !== undefined && !Array.isArray(section.blocks)) issues.push({ path: `${path}.section.blocks`, message: "Section blocks must be a list" });
    });
  }
  if (issues.length) throw new ApiError(400, "TEMPLATE_LAYOUT_INVALID", "The page layout could not be saved because it is not in the expected format.", issues);
  return structuredClone(layout);
}

function requireTemplate(
  template: StorefrontTemplateRecord | null,
): StorefrontTemplateRecord {
  if (!template) throw new ApiError(404, "STOREFRONT_RESOURCE_NOT_FOUND", "Template was not found");
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
    const name = normalizeName(input.name);
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
      ...(patch.name !== undefined ? { name: normalizeName(patch.name) } : {}),
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
      name: normalizeName(input.name),
      handle: normalizeHandle(input.handle),
    };

    const mutation = await this.coordinator.run(storeId, async (transaction) => requireTemplate(
      await this.repository.cloneTemplate(transaction, storeId, sourceTemplateId, cloneInput),
    ));
    return { template: mutation.result, generation: mutation.generation };
  }

  /** Default templates and templates still used by a product, collection or page are kept. */
  async deleteTemplate(storeId: string, templateId: string, expectedRevision: number): Promise<TemplateDeletionResult> {
    // Read before the transaction; the revision check below catches a rename made in between.
    const template = requireTemplate(await this.repository.getTemplate(storeId, templateId));
    if (template.handle === "default") {
      throw new ApiError(409, "TEMPLATE_IS_DEFAULT", "This is the main template for its page type, so it can't be deleted.");
    }
    const mutation = await this.coordinator.run(storeId, async (transaction) => {
      const assignments = await this.repository.countAssignments(transaction, storeId, templateId);
      if (assignments > 0) {
        throw new ApiError(409, "TEMPLATE_IN_USE", `This template is used by ${assignments} ${assignments === 1 ? "item" : "items"}. Switch them to another template first.`);
      }
      return requireTemplate(await this.repository.deleteTemplate(transaction, storeId, templateId, expectedRevision));
    });
    return { templateId: mutation.result.id, generation: mutation.generation };
  }
}
