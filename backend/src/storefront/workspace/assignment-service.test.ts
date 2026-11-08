import { describe, expect, it, vi } from "vitest";
import type { WorkspaceTransaction } from "./concurrency.js";
import { AssignmentService } from "./assignment-service.js";
import type { AssignmentRepository } from "./repositories/assignment-repository.js";

const tx = {} as WorkspaceTransaction;

function setup(options: { resourceExists?: boolean; templateType?: string | null; hasAssignment?: boolean } = {}) {
  let generation = 0;
  const repository: AssignmentRepository = {
    getAssignment: vi.fn(async () => null),
    getTemplateType: vi.fn(async () => (options.templateType ?? "product") as never),
    resourceExists: vi.fn(async () => options.resourceExists ?? true),
    upsertAssignment: vi.fn(async (_tx, input) => ({
      storeId: input.storeId,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      templateId: input.templateId,
      revision: input.expectedRevision === null ? 0 : input.expectedRevision + 1,
      updatedAt: new Date(0),
    })),
    deleteAssignment: vi.fn(async () => options.hasAssignment ?? true),
  };
  const coordinator = {
    async run<T>(_storeId: string, operation: (transaction: WorkspaceTransaction) => Promise<T>) {
      const result = await operation(tx);
      generation += 1;
      return { result, generation };
    },
  };
  return { repository, service: new AssignmentService(repository, coordinator), generation: () => generation };
}

describe("AssignmentService", () => {
  it("assigns a product only to a product template", async () => {
    const { service } = setup();
    const result = await service.assignTemplate("store-a", {
      resourceType: "product",
      resourceId: "product-1",
      templateId: "template-product",
      expectedRevision: null,
    });

    expect(result.assignment).toMatchObject({
      resourceType: "product",
      resourceId: "product-1",
      templateId: "template-product",
      revision: 0,
    });
    expect(result.generation).toBe(1);
  });

  it("rejects a resource that does not belong to the store", async () => {
    const { service } = setup({ resourceExists: false });

    await expect(service.assignTemplate("store-a", {
      resourceType: "product",
      resourceId: "product-from-store-b",
      templateId: "template-product",
      expectedRevision: null,
    })).rejects.toMatchObject({ status: 404, message: "This product was not found in your store." });
  });

  it("rejects a template type that does not match the resource type", async () => {
    const { service } = setup({ templateType: "page" });

    await expect(service.assignTemplate("store-a", {
      resourceType: "product",
      resourceId: "product-1",
      templateId: "template-page",
      expectedRevision: null,
    })).rejects.toMatchObject({ status: 400, code: "TEMPLATE_TYPE_MISMATCH", message: "A product can only use a product template." });
  });

  it("passes an existing assignment revision through to the repository", async () => {
    const { service, repository } = setup();
    await service.assignTemplate("store-a", {
      resourceType: "product",
      resourceId: "product-1",
      templateId: "template-product",
      expectedRevision: 4,
    });

    expect(repository.upsertAssignment).toHaveBeenCalledWith(tx, expect.objectContaining({ expectedRevision: 4 }));
  });

  it("removes an assignment so the resource uses the default template again", async () => {
    const { service, repository } = setup();
    const result = await service.removeAssignment("store-a", { resourceType: "collection", resourceId: "beds", expectedRevision: 2 });

    expect(result.generation).toBe(1);
    expect(repository.deleteAssignment).toHaveBeenCalledWith(tx, { storeId: "store-a", resourceType: "collection", resourceId: "beds", expectedRevision: 2 });
  });

  it("reports a missing assignment without advancing the generation", async () => {
    const { service, generation } = setup({ hasAssignment: false });

    await expect(service.removeAssignment("store-a", { resourceType: "article", resourceId: "post-1", expectedRevision: 0 }))
      .rejects.toMatchObject({ status: 404, message: "This blog post already uses the default template." });
    expect(generation()).toBe(0);
  });
});
