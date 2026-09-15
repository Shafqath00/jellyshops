import { describe, expect, it, vi } from "vitest";
import type { WorkspaceTransaction } from "./concurrency.js";
import { AssignmentService } from "./assignment-service.js";
import type { AssignmentRepository } from "./repositories/assignment-repository.js";

const tx = {} as WorkspaceTransaction;

function setup(options: { resourceExists?: boolean; templateType?: string | null } = {}) {
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
  };
  const coordinator = {
    async run<T>(_storeId: string, operation: (transaction: WorkspaceTransaction) => Promise<T>) {
      const result = await operation(tx);
      generation += 1;
      return { result, generation };
    },
  };
  return { repository, service: new AssignmentService(repository, coordinator) };
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
    })).rejects.toThrow(/belong to this store/i);
  });

  it("rejects a template type that does not match the resource type", async () => {
    const { service } = setup({ templateType: "page" });

    await expect(service.assignTemplate("store-a", {
      resourceType: "product",
      resourceId: "product-1",
      templateId: "template-page",
      expectedRevision: null,
    })).rejects.toThrow(/product template/i);
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
});
