import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createIntegrationDatabase, type IntegrationDatabase } from "./database.js";

async function seedStore(database: IntegrationDatabase, id: string, slug: string) {
  return database.database.client.store.create({
    data: { id, name: id, slug, currency: "USD", country: "US" },
  });
}

describe("normalized storefront workspace schema", () => {
  let integration: IntegrationDatabase;

  beforeEach(async () => {
    integration = await createIntegrationDatabase();
    await seedStore(integration, "store-a", "store-a");
    await seedStore(integration, "store-b", "store-b");
  });

  afterEach(async () => integration.close());

  it("allows only one workspace and theme configuration per store", async () => {
    await integration.database.client.storefrontWorkspace.create({ data: { storeId: "store-a" } });
    await expect(integration.database.client.storefrontWorkspace.create({ data: { storeId: "store-a" } }))
      .rejects.toBeTruthy();

    await integration.database.client.themeConfiguration.create({
      data: { storeId: "store-a", themeId: "minimal", settings: {} },
    });
    await expect(integration.database.client.themeConfiguration.create({
      data: { storeId: "store-a", themeId: "classic", settings: {} },
    })).rejects.toBeTruthy();
  });

  it("scopes template handles by store and resource type", async () => {
    const template = { type: "PRODUCT" as const, handle: "default", name: "Default product", layout: { sections: [] } };
    await integration.database.client.storefrontTemplate.create({ data: { storeId: "store-a", ...template } });
    await integration.database.client.storefrontTemplate.create({ data: { storeId: "store-b", ...template } });
    await integration.database.client.storefrontTemplate.create({
      data: { storeId: "store-a", type: "PAGE", handle: "default", name: "Default page", layout: { sections: [] } },
    });
    await expect(integration.database.client.storefrontTemplate.create({ data: { storeId: "store-a", ...template } }))
      .rejects.toBeTruthy();
  });

  it("rejects cross-store template assignments structurally", async () => {
    const template = await integration.database.client.storefrontTemplate.create({
      data: { storeId: "store-b", type: "PRODUCT", handle: "default", name: "Default", layout: { sections: [] } },
    });
    await expect(integration.database.client.storefrontTemplateAssignment.create({
      data: { storeId: "store-a", resourceType: "product", resourceId: "product-a", templateId: template.id },
    })).rejects.toBeTruthy();
  });

  it("allows the same page and blog handles in separate stores but not within one store", async () => {
    await integration.database.client.storePage.create({ data: { storeId: "store-a", title: "About", handle: "about", content: {} } });
    await integration.database.client.storePage.create({ data: { storeId: "store-b", title: "About", handle: "about", content: {} } });
    await expect(integration.database.client.storePage.create({ data: { storeId: "store-a", title: "Again", handle: "about", content: {} } }))
      .rejects.toBeTruthy();

    await integration.database.client.blog.create({ data: { storeId: "store-a", title: "Journal", handle: "journal" } });
    await integration.database.client.blog.create({ data: { storeId: "store-b", title: "Journal", handle: "journal" } });
  });

  it("starts workspace generation and resource revisions at zero", async () => {
    const workspace = await integration.database.client.storefrontWorkspace.create({ data: { storeId: "store-a" } });
    const template = await integration.database.client.storefrontTemplate.create({
      data: { storeId: "store-a", type: "HOME", handle: "default", name: "Home", layout: { sections: [] } },
    });
    expect(workspace.generation).toBe(0);
    expect(template.revision).toBe(0);
  });
});
