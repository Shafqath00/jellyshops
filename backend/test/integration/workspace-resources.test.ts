import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AssignmentService } from "../../src/storefront/workspace/assignment-service.js";
import { GlobalSectionService } from "../../src/storefront/workspace/global-section-service.js";
import { MenuService } from "../../src/storefront/workspace/menu-service.js";
import { PrismaWorkspaceMutationCoordinator } from "../../src/storefront/workspace/prisma-mutation-coordinator.js";
import { PrismaAssignmentRepository } from "../../src/storefront/workspace/repositories/prisma-assignment-repository.js";
import { PrismaGlobalSectionRepository } from "../../src/storefront/workspace/repositories/prisma-global-section-repository.js";
import { PrismaMenuRepository } from "../../src/storefront/workspace/repositories/prisma-menu-repository.js";
import { PrismaPresetRepository } from "../../src/storefront/workspace/repositories/prisma-preset-repository.js";
import { PrismaThemeRepository } from "../../src/storefront/workspace/repositories/prisma-theme-repository.js";
import { ThemeService } from "../../src/storefront/workspace/theme-service.js";
import { createIntegrationDatabase, type IntegrationDatabase } from "./database.js";

async function seed(integration: IntegrationDatabase) {
  await integration.database.client.store.createMany({
    data: [
      { id: "store-a", name: "Store A", slug: "store-a", currency: "USD", country: "US" },
      { id: "store-b", name: "Store B", slug: "store-b", currency: "USD", country: "US" },
    ],
  });
  await integration.database.client.product.create({
    data: { id: "product-a", storeId: "store-a", title: "A", slug: "a" },
  });
  await integration.database.client.product.create({
    data: { id: "product-b", storeId: "store-b", title: "B", slug: "b" },
  });
  await integration.database.client.storefrontTemplate.createMany({
    data: [
      { id: "product-template", storeId: "store-a", type: "PRODUCT", handle: "default", name: "Product", layout: { sections: [] } },
      { id: "page-template", storeId: "store-a", type: "PAGE", handle: "default", name: "Page", layout: { sections: [] } },
    ],
  });
}

describe("normalized workspace resource services", () => {
  let integration: IntegrationDatabase;
  let coordinator: PrismaWorkspaceMutationCoordinator;

  beforeEach(async () => {
    integration = await createIntegrationDatabase();
    await seed(integration);
    coordinator = new PrismaWorkspaceMutationCoordinator(integration.database.client);
  });

  afterEach(async () => integration.close());

  it("keeps preset copies detached and global sections versioned", async () => {
    const service = new GlobalSectionService(
      new PrismaGlobalSectionRepository(integration.database.client),
      new PrismaPresetRepository(integration.database.client),
      coordinator,
    );
    const global = await service.createGlobalSection("store-a", {
      name: "Promo",
      section: { type: "banner", settings: { heading: "Sale" } },
    });
    const preset = await service.createPreset("store-a", {
      name: "Promo preset",
      section: global.globalSection.section,
    });
    const detached = await service.instantiatePreset("store-a", preset.preset.id);
    (detached.settings as { heading: string }).heading = "Local";

    await expect(service.instantiatePreset("store-a", preset.preset.id))
      .resolves.toMatchObject({ settings: { heading: "Sale" } });
    const updated = await service.updateGlobalSection("store-a", global.globalSection.id, 0, {
      section: { type: "banner", settings: { heading: "Updated everywhere" } },
    });
    expect(updated.globalSection.revision).toBe(1);
    expect(updated.generation).toBe(3);
  });

  it("rejects cross-store resource targets in navigation", async () => {
    const service = new MenuService(new PrismaMenuRepository(integration.database.client), coordinator);

    await expect(service.createMenu("store-a", {
      name: "Main",
      handle: "main",
      items: [{
        id: "other",
        label: "Other product",
        target: { kind: "product", resourceId: "product-b" },
        children: [],
      }],
    })).rejects.toThrow(/belong to this store/i);

    await expect(integration.database.client.storefrontWorkspace.findUnique({ where: { storeId: "store-a" } }))
      .resolves.toBeNull();
  });

  it("enforces resource/template compatibility before assignment mutation", async () => {
    const service = new AssignmentService(new PrismaAssignmentRepository(integration.database.client), coordinator);

    await expect(service.assignTemplate("store-a", {
      resourceType: "product",
      resourceId: "product-a",
      templateId: "page-template",
      expectedRevision: null,
    })).rejects.toThrow(/product template/i);

    const assigned = await service.assignTemplate("store-a", {
      resourceType: "product",
      resourceId: "product-a",
      templateId: "product-template",
      expectedRevision: null,
    });
    expect(assigned.assignment.revision).toBe(0);
    expect(assigned.generation).toBe(1);
  });

  it("versions theme settings through the shared coordinator", async () => {
    const service = new ThemeService(new PrismaThemeRepository(integration.database.client), coordinator);
    const created = await service.saveThemeConfiguration("store-a", null, {
      themeId: "minimal",
      settings: { colors: { accent: "#000000" } },
    });
    const updated = await service.saveThemeConfiguration("store-a", 0, {
      themeId: "minimal",
      settings: { colors: { accent: "#ffffff" } },
    });

    expect(created.theme.revision).toBe(0);
    expect(updated.theme.revision).toBe(1);
    expect(updated.generation).toBe(2);
  });
});
