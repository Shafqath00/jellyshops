import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  assertExpectedRevision,
  assertWorkspaceGeneration,
  nextRevision,
} from "../../src/storefront/workspace/concurrency.js";
import {
  ResourceRevisionConflictError,
  WorkspaceGenerationConflictError,
} from "../../src/storefront/workspace/errors.js";
import { PrismaWorkspaceMutationCoordinator } from "../../src/storefront/workspace/prisma-mutation-coordinator.js";
import { createIntegrationDatabase, type IntegrationDatabase } from "./database.js";

async function seed(integration: IntegrationDatabase) {
  await integration.database.client.store.create({
    data: { id: "store-a", name: "Store A", slug: "store-a", currency: "USD", country: "US" },
  });
  await integration.database.client.storefrontWorkspace.create({ data: { storeId: "store-a" } });
  await integration.database.client.storefrontTemplate.create({
    data: { id: "template-a", storeId: "store-a", type: "PRODUCT", handle: "default", name: "Default", layout: { sections: [] } },
  });
  await integration.database.client.navigationMenu.create({
    data: { id: "menu-a", storeId: "store-a", handle: "main", name: "Main", items: [] },
  });
}

describe("PrismaWorkspaceMutationCoordinator", () => {
  let integration: IntegrationDatabase;
  let coordinator: PrismaWorkspaceMutationCoordinator;

  beforeEach(async () => {
    integration = await createIntegrationDatabase();
    await seed(integration);
    coordinator = new PrismaWorkspaceMutationCoordinator(integration.database.client);
  });

  afterEach(async () => integration.close());

  it("increments the resource revision and workspace generation exactly once", async () => {
    const result = await coordinator.run("store-a", async (tx) => {
      const current = await tx.storefrontTemplate.findFirstOrThrow({ where: { storeId: "store-a", id: "template-a" } });
      assertExpectedRevision(current.revision, 0);
      return tx.storefrontTemplate.update({
        where: { id: current.id },
        data: { revision: nextRevision(current.revision), name: "Updated" },
      });
    });

    expect(result.result.revision).toBe(1);
    expect(result.generation).toBe(1);
    await expect(integration.database.client.storefrontWorkspace.findUniqueOrThrow({ where: { storeId: "store-a" } }))
      .resolves.toMatchObject({ generation: 1 });
  });

  it("rolls back both resource mutation and generation when the operation throws", async () => {
    await expect(coordinator.run("store-a", async (tx) => {
      await tx.storefrontTemplate.update({ where: { id: "template-a" }, data: { revision: 1, name: "Should roll back" } });
      throw new Error("operation failed");
    })).rejects.toThrow("operation failed");

    await expect(integration.database.client.storefrontTemplate.findUniqueOrThrow({ where: { id: "template-a" } }))
      .resolves.toMatchObject({ revision: 0, name: "Default" });
    await expect(integration.database.client.storefrontWorkspace.findUniqueOrThrow({ where: { storeId: "store-a" } }))
      .resolves.toMatchObject({ generation: 0 });
  });

  it("rejects a stale resource revision without changing workspace generation", async () => {
    await integration.database.client.storefrontTemplate.update({ where: { id: "template-a" }, data: { revision: 1 } });

    await expect(coordinator.run("store-a", async (tx) => {
      const current = await tx.storefrontTemplate.findUniqueOrThrow({ where: { id: "template-a" } });
      assertExpectedRevision(current.revision, 0);
    })).rejects.toMatchObject<ResourceRevisionConflictError>({ currentRevision: 1 });

    await expect(integration.database.client.storefrontWorkspace.findUniqueOrThrow({ where: { storeId: "store-a" } }))
      .resolves.toMatchObject({ generation: 0 });
  });

  it("lets independent resources save with their own revisions across workspace generations", async () => {
    const templateSave = await coordinator.run("store-a", async (tx) => {
      const template = await tx.storefrontTemplate.findUniqueOrThrow({ where: { id: "template-a" } });
      assertExpectedRevision(template.revision, 0);
      return tx.storefrontTemplate.update({ where: { id: template.id }, data: { revision: 1, name: "Template edit" } });
    });
    const menuSave = await coordinator.run("store-a", async (tx) => {
      const menu = await tx.navigationMenu.findUniqueOrThrow({ where: { id: "menu-a" } });
      assertExpectedRevision(menu.revision, 0);
      return tx.navigationMenu.update({ where: { id: menu.id }, data: { revision: 1, name: "Menu edit" } });
    });

    expect(templateSave.generation).toBe(1);
    expect(menuSave.generation).toBe(2);
    expect(menuSave.result.revision).toBe(1);
  });

  it("serializes concurrent successful mutations into unique monotonic generations", async () => {
    await integration.database.client.globalSection.createMany({
      data: Array.from({ length: 5 }, (_, index) => ({
        id: `global-${index}`,
        storeId: "store-a",
        name: `Global ${index}`,
        section: { id: `section-${index}`, type: "rich-text", settings: {} },
      })),
    });

    const results = await Promise.all(Array.from({ length: 5 }, (_, index) => coordinator.run("store-a", async (tx) => {
      const section = await tx.globalSection.findUniqueOrThrow({ where: { id: `global-${index}` } });
      return tx.globalSection.update({ where: { id: section.id }, data: { revision: nextRevision(section.revision) } });
    })));

    expect(results.map(({ generation }) => generation).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
    await expect(integration.database.client.storefrontWorkspace.findUniqueOrThrow({ where: { storeId: "store-a" } }))
      .resolves.toMatchObject({ generation: 5 });
  });

  it("reports the current generation when a publish-style assertion is stale", async () => {
    await coordinator.run("store-a", async (tx) => tx.navigationMenu.update({ where: { id: "menu-a" }, data: { revision: 1 } }));

    await expect(integration.database.client.$transaction((tx) => assertWorkspaceGeneration("store-a", 0, tx)))
      .rejects.toMatchObject<WorkspaceGenerationConflictError>({ currentGeneration: 1 });
  });
});
