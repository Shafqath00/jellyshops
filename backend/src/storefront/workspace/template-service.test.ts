import { describe, expect, it } from "vitest";
import type { WorkspaceTransaction } from "./concurrency.js";
import { assertExpectedRevision, nextRevision } from "./concurrency.js";
import { ResourceRevisionConflictError } from "./errors.js";
import type {
  CreateTemplateRecordInput,
  StorefrontTemplateRecord,
  TemplateRepository,
  UpdateTemplateRecordInput,
} from "./repositories/template-repository.js";
import { TemplateService } from "./template-service.js";

class MemoryTemplateRepository implements TemplateRepository {
  private readonly templates = new Map<string, StorefrontTemplateRecord>();
  readonly assignmentCounts = new Map<string, number>();

  async getTemplate(storeId: string, templateId: string): Promise<StorefrontTemplateRecord | null> {
    const template = this.templates.get(templateId);
    return template?.storeId === storeId ? structuredClone(template) : null;
  }

  async listTemplates(storeId: string): Promise<StorefrontTemplateRecord[]> {
    return [...this.templates.values()]
      .filter((template) => template.storeId === storeId)
      .map((template) => structuredClone(template));
  }

  async createTemplate(
    _transaction: WorkspaceTransaction,
    input: CreateTemplateRecordInput,
  ): Promise<StorefrontTemplateRecord> {
    const now = new Date(0);
    const template: StorefrontTemplateRecord = {
      id: `template-${this.templates.size + 1}`,
      revision: 0,
      createdAt: now,
      updatedAt: now,
      ...structuredClone(input),
    };
    this.templates.set(template.id, template);
    return structuredClone(template);
  }

  async updateTemplate(
    _transaction: WorkspaceTransaction,
    storeId: string,
    templateId: string,
    expectedRevision: number,
    patch: UpdateTemplateRecordInput,
  ): Promise<StorefrontTemplateRecord | null> {
    const current = this.templates.get(templateId);
    if (!current || current.storeId !== storeId) return null;
    assertExpectedRevision(current.revision, expectedRevision);
    const updated: StorefrontTemplateRecord = {
      ...current,
      ...structuredClone(patch),
      revision: nextRevision(current.revision),
      updatedAt: new Date(current.updatedAt.getTime() + 1),
    };
    this.templates.set(templateId, updated);
    return structuredClone(updated);
  }

  async cloneTemplate(
    _transaction: WorkspaceTransaction,
    storeId: string,
    sourceTemplateId: string,
    input: { name: string; handle: string },
  ): Promise<StorefrontTemplateRecord | null> {
    const source = this.templates.get(sourceTemplateId);
    if (!source || source.storeId !== storeId) return null;
    return this.createTemplate({} as WorkspaceTransaction, {
      storeId,
      type: source.type,
      name: input.name,
      handle: input.handle,
      layout: structuredClone(source.layout),
    });
  }

  async countAssignments(_transaction: WorkspaceTransaction, _storeId: string, templateId: string): Promise<number> {
    return this.assignmentCounts.get(templateId) ?? 0;
  }

  async deleteTemplate(
    _transaction: WorkspaceTransaction,
    storeId: string,
    templateId: string,
    expectedRevision: number,
  ): Promise<StorefrontTemplateRecord | null> {
    const current = this.templates.get(templateId);
    if (!current || current.storeId !== storeId) return null;
    assertExpectedRevision(current.revision, expectedRevision);
    this.templates.delete(templateId);
    return structuredClone(current);
  }
}

function setup() {
  let generation = 0;
  const repository = new MemoryTemplateRepository();
  const coordinator = {
    async run<T>(_storeId: string, operation: (transaction: WorkspaceTransaction) => Promise<T>) {
      const result = await operation({} as WorkspaceTransaction);
      generation += 1;
      return { result, generation };
    },
  };
  return {
    repository,
    service: new TemplateService(repository, coordinator),
    generation: () => generation,
  };
}

describe("TemplateService", () => {
  it("uses the default handle when a template handle is omitted", async () => {
    const { service } = setup();

    const created = await service.createTemplate("store-a", {
      type: "product",
      name: "Default product",
      layout: { sections: [] },
    });

    expect(created.template).toMatchObject({
      type: "product",
      handle: "default",
      revision: 0,
    });
    expect(created.generation).toBe(1);
  });

  it("increments only the template revision while the coordinator owns generation", async () => {
    const { service } = setup();
    const created = await service.createTemplate("store-a", {
      type: "product",
      name: "Default product",
      layout: { sections: [] },
    });

    const updated = await service.updateTemplate(
      "store-a",
      created.template.id,
      0,
      { name: "Updated product" },
    );

    expect(updated.template.revision).toBe(1);
    expect(updated.generation).toBe(2);
  });

  it("rejects a stale template revision without advancing generation", async () => {
    const { service, generation } = setup();
    const created = await service.createTemplate("store-a", {
      type: "product",
      name: "Default product",
      layout: { sections: [] },
    });
    await service.updateTemplate("store-a", created.template.id, 0, { name: "Current" });

    await expect(service.updateTemplate("store-a", created.template.id, 0, { name: "Stale" }))
      .rejects.toMatchObject<ResourceRevisionConflictError>({ currentRevision: 1 });
    expect(generation()).toBe(2);
  });

  it("clones the source layout into a new revision-zero template", async () => {
    const { service } = setup();
    const source = await service.createTemplate("store-a", {
      type: "product",
      name: "Default product",
      layout: { sections: [{ kind: "inline", section: { id: "hero", type: "hero", enabled: true, settings: { heading: "Hello" }, blocks: [] } }] },
    });

    const cloned = await service.cloneTemplate("store-a", source.template.id, {
      name: "Featured product",
      handle: "featured",
    });

    expect(cloned.template).toMatchObject({
      type: "product",
      handle: "featured",
      revision: 0,
      layout: source.template.layout,
    });
    expect(cloned.template.id).not.toBe(source.template.id);
    expect(cloned.generation).toBe(2);
  });

  it("explains invalid names, handles and layouts with 400 errors", async () => {
    const { service, generation } = setup();

    await expect(service.createTemplate("store-a", { type: "product", name: "  ", layout: { sections: [] } }))
      .rejects.toMatchObject({ status: 400, code: "TEMPLATE_NAME_REQUIRED" });
    await expect(service.createTemplate("store-a", { type: "product", name: "Mattress", handle: "Mattress page!", layout: { sections: [] } }))
      .rejects.toMatchObject({ status: 400, code: "TEMPLATE_HANDLE_INVALID" });
    await expect(service.createTemplate("store-a", { type: "product", name: "Mattress", handle: "previous-mattress", layout: { sections: [] } }))
      .rejects.toMatchObject({ status: 400, code: "TEMPLATE_HANDLE_RESERVED" });
    await expect(service.createTemplate("store-a", { type: "product", name: "Mattress", handle: "mattress", layout: {} }))
      .rejects.toMatchObject({ status: 400, code: "TEMPLATE_LAYOUT_INVALID", issues: [{ path: "layout.sections" }] });
    await expect(service.createTemplate("store-a", {
      type: "product",
      name: "Mattress",
      handle: "mattress",
      layout: { sections: [
        { kind: "inline", section: { id: "a", type: "hero", blocks: [] } },
        { kind: "inline", section: { id: "a", type: "rich-text" } },
        { kind: "global" },
        { id: "loose" },
      ] },
    })).rejects.toMatchObject({
      issues: [
        { path: "layout.sections.1.section.id", message: "Section ids must be unique in a template" },
        { path: "layout.sections.2", message: "Shared section placement needs a section id" },
        { path: "layout.sections.3", message: "Each placement must be an inline section or a shared section" },
      ],
    });
    expect(generation()).toBe(0);
  });

  it("returns 404 when updating a template that does not exist", async () => {
    const { service } = setup();

    await expect(service.updateTemplate("store-a", "missing", 0, { name: "Anything" }))
      .rejects.toMatchObject({ status: 404, code: "STOREFRONT_RESOURCE_NOT_FOUND" });
  });

  it("deletes an unused alternate template", async () => {
    const { service, repository } = setup();
    const created = await service.createTemplate("store-a", { type: "product", name: "Mattress", handle: "mattress", layout: { sections: [] } });

    const result = await service.deleteTemplate("store-a", created.template.id, 0);

    expect(result).toEqual({ templateId: created.template.id, generation: 2 });
    expect(await repository.getTemplate("store-a", created.template.id)).toBeNull();
  });

  it("keeps default templates and templates still assigned to something", async () => {
    const { service, repository, generation } = setup();
    const main = await service.createTemplate("store-a", { type: "product", name: "Product", layout: { sections: [] } });
    const alternate = await service.createTemplate("store-a", { type: "product", name: "Mattress", handle: "mattress", layout: { sections: [] } });
    repository.assignmentCounts.set(alternate.template.id, 3);

    await expect(service.deleteTemplate("store-a", main.template.id, 0)).rejects.toMatchObject({ status: 409, code: "TEMPLATE_IS_DEFAULT" });
    await expect(service.deleteTemplate("store-a", alternate.template.id, 0))
      .rejects.toMatchObject({ status: 409, code: "TEMPLATE_IN_USE", message: "This template is used by 3 items. Switch them to another template first." });
    await expect(service.deleteTemplate("store-a", "missing", 0)).rejects.toMatchObject({ status: 404 });
    expect(generation()).toBe(2);
  });
});
