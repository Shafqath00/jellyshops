import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ResourceRevisionConflictError } from "../../src/storefront/workspace/errors.js";
import { PrismaWorkspaceMutationCoordinator } from "../../src/storefront/workspace/prisma-mutation-coordinator.js";
import { PrismaTemplateRepository } from "../../src/storefront/workspace/repositories/prisma-template-repository.js";
import { TemplateService } from "../../src/storefront/workspace/template-service.js";
import { createIntegrationDatabase, type IntegrationDatabase } from "./database.js";

async function seed(integration: IntegrationDatabase) {
  await integration.database.client.store.create({
    data: { id: "store-a", name: "Store A", slug: "store-a", currency: "USD", country: "US" },
  });
  await integration.database.client.store.create({
    data: { id: "store-b", name: "Store B", slug: "store-b", currency: "USD", country: "US" },
  });
}

describe("PrismaTemplateRepository", () => {
  let integration: IntegrationDatabase;
  let service: TemplateService;

  beforeEach(async () => {
    integration = await createIntegrationDatabase();
    await seed(integration);
    const repository = new PrismaTemplateRepository(integration.database.client);
    const coordinator = new PrismaWorkspaceMutationCoordinator(integration.database.client);
    service = new TemplateService(repository, coordinator);
  });

  afterEach(async () => integration.close());

  it("creates a default-handle template and bumps workspace generation once", async () => {
    const created = await service.createTemplate("store-a", {
      type: "product",
      name: "Default product",
      layout: { sections: [] },
    });

    expect(created.template).toMatchObject({
      storeId: "store-a",
      type: "product",
      handle: "default",
      revision: 0,
    });
    expect(created.generation).toBe(1);
    await expect(integration.database.client.storefrontWorkspace.findUniqueOrThrow({ where: { storeId: "store-a" } }))
      .resolves.toMatchObject({ generation: 1 });
  });

  it("updates revision and generation atomically", async () => {
    const created = await service.createTemplate("store-a", {
      type: "product",
      name: "Default product",
      layout: { sections: [] },
    });

    const updated = await service.updateTemplate(
      "store-a",
      created.template.id,
      0,
      { name: "Updated product", layout: { sections: [{ id: "hero" }] } },
    );

    expect(updated.template).toMatchObject({ revision: 1, name: "Updated product" });
    expect(updated.generation).toBe(2);
  });

  it("rejects stale revision and leaves workspace generation unchanged", async () => {
    const created = await service.createTemplate("store-a", {
      type: "product",
      name: "Default product",
      layout: { sections: [] },
    });
    await service.updateTemplate("store-a", created.template.id, 0, { name: "Current" });

    await expect(service.updateTemplate("store-a", created.template.id, 0, { name: "Stale" }))
      .rejects.toMatchObject<ResourceRevisionConflictError>({ currentRevision: 1 });

    await expect(integration.database.client.storefrontWorkspace.findUniqueOrThrow({ where: { storeId: "store-a" } }))
      .resolves.toMatchObject({ generation: 2 });
  });

  it("clones layout in the coordinator transaction and keeps the source unchanged", async () => {
    const source = await service.createTemplate("store-a", {
      type: "product",
      name: "Default product",
      layout: { sections: [{ id: "hero", settings: { heading: "Source" } }] },
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
    expect(cloned.generation).toBe(2);
    await expect(service.getTemplate("store-a", source.template.id))
      .resolves.toMatchObject({ name: "Default product", revision: 0 });
  });

  it("never returns a template through another store scope", async () => {
    const created = await service.createTemplate("store-a", {
      type: "page",
      name: "Default page",
      layout: { sections: [] },
    });

    await expect(service.getTemplate("store-b", created.template.id)).resolves.toBeNull();
  });
});
