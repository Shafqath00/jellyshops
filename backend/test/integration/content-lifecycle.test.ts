import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PrismaContentRepository } from "../../src/content/prisma-repository.js";
import { ContentService } from "../../src/content/service.js";
import { AssignmentService } from "../../src/storefront/workspace/assignment-service.js";
import { PrismaWorkspaceMutationCoordinator } from "../../src/storefront/workspace/prisma-mutation-coordinator.js";
import { PrismaAssignmentRepository } from "../../src/storefront/workspace/repositories/prisma-assignment-repository.js";
import { createIntegrationDatabase, type IntegrationDatabase } from "./database.js";

describe("content lifecycle and storefront generation", () => {
  let integration: IntegrationDatabase;

  beforeEach(async () => {
    integration = await createIntegrationDatabase();
    await integration.database.client.store.create({
      data: { id: "store-a", name: "Store A", slug: "store-a", currency: "USD", country: "US" },
    });
    await integration.database.client.storefrontWorkspace.create({ data: { storeId: "store-a" } });
    await integration.database.client.storefrontTemplate.create({
      data: {
        id: "page-default",
        storeId: "store-a",
        type: "PAGE",
        handle: "default",
        name: "Default page",
        layout: { sections: [] },
      },
    });
  });

  afterEach(async () => integration.close());

  it("does not bump workspace generation for content edits or publishing", async () => {
    const repository = new PrismaContentRepository(integration.database.client);
    const service = new ContentService(repository, () => new Date("2026-09-13T12:00:00Z"));

    const page = await service.createPage("store-a", {
      title: "About",
      handle: "about",
      content: { blocks: [] },
      seoTitle: "About",
      noindex: false,
    });
    await service.updatePage("store-a", page.id, {
      title: "About Jelly",
      seoDescription: "Our story",
    });
    await service.publishPage("store-a", page.id);

    await expect(integration.database.client.storefrontWorkspace.findUniqueOrThrow({ where: { storeId: "store-a" } }))
      .resolves.toMatchObject({ generation: 0 });
  });

  it("bumps workspace generation when the same page receives a template assignment", async () => {
    const content = new ContentService(new PrismaContentRepository(integration.database.client));
    const page = await content.createPage("store-a", {
      title: "Contact",
      handle: "contact",
      content: {},
      noindex: false,
    });

    const assignments = new AssignmentService(
      new PrismaAssignmentRepository(integration.database.client),
      new PrismaWorkspaceMutationCoordinator(integration.database.client),
    );
    const result = await assignments.assignTemplate("store-a", {
      resourceType: "page",
      resourceId: page.id,
      templateId: "page-default",
      expectedRevision: null,
    });

    expect(result.generation).toBe(1);
    await expect(integration.database.client.storefrontWorkspace.findUniqueOrThrow({ where: { storeId: "store-a" } }))
      .resolves.toMatchObject({ generation: 1 });
  });
});
