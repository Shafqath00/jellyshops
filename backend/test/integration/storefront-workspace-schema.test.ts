import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createPGliteDatabase, seedStore, type IntegrationDatabase } from "./pglite.js";

describe("normalized storefront workspace schema", () => {
  let integration: IntegrationDatabase;

  beforeEach(async () => {
    integration = await createPGliteDatabase();
    await seedStore(integration, "store-a", "store-a");
    await seedStore(integration, "store-b", "store-b");
  });

  afterEach(async () => integration.close());

  it("allows only one workspace and theme configuration per store", async () => {
    await integration.query(`INSERT INTO "StorefrontWorkspace" ("storeId", "updatedAt") VALUES ($1, CURRENT_TIMESTAMP)`, ["store-a"]);
    await expect(integration.query(`INSERT INTO "StorefrontWorkspace" ("storeId", "updatedAt") VALUES ($1, CURRENT_TIMESTAMP)`, ["store-a"]))
      .rejects.toBeTruthy();

    await integration.query(`INSERT INTO "ThemeConfiguration" ("storeId", "themeId", "settings", "updatedAt") VALUES ($1, $2, $3::jsonb, CURRENT_TIMESTAMP)`, ["store-a", "minimal", "{}"]);
    await expect(integration.query(`INSERT INTO "ThemeConfiguration" ("storeId", "themeId", "settings", "updatedAt") VALUES ($1, $2, $3::jsonb, CURRENT_TIMESTAMP)`, ["store-a", "classic", "{}"])).rejects.toBeTruthy();
  });

  it("scopes template handles by store and resource type", async () => {
    const template = { type: "PRODUCT" as const, handle: "default", name: "Default product", layout: { sections: [] } };
    await integration.query(`INSERT INTO "StorefrontTemplate" ("id", "storeId", "type", "handle", "name", "layout", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6::jsonb, CURRENT_TIMESTAMP)`, ["template-a-product", "store-a", template.type, template.handle, template.name, JSON.stringify(template.layout)]);
    await integration.query(`INSERT INTO "StorefrontTemplate" ("id", "storeId", "type", "handle", "name", "layout", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6::jsonb, CURRENT_TIMESTAMP)`, ["template-b-product", "store-b", template.type, template.handle, template.name, JSON.stringify(template.layout)]);
    await integration.query(`INSERT INTO "StorefrontTemplate" ("id", "storeId", "type", "handle", "name", "layout", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6::jsonb, CURRENT_TIMESTAMP)`, ["template-a-page", "store-a", "PAGE", "default", "Default page", JSON.stringify({ sections: [] })]);
    await expect(integration.query(`INSERT INTO "StorefrontTemplate" ("id", "storeId", "type", "handle", "name", "layout", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6::jsonb, CURRENT_TIMESTAMP)`, ["template-a-duplicate", "store-a", template.type, template.handle, template.name, JSON.stringify(template.layout)]))
      .rejects.toBeTruthy();
  });

  it("rejects cross-store template assignments structurally", async () => {
    await integration.query(`INSERT INTO "StorefrontTemplate" ("id", "storeId", "type", "handle", "name", "layout", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6::jsonb, CURRENT_TIMESTAMP)`, ["template-b", "store-b", "PRODUCT", "default", "Default", JSON.stringify({ sections: [] })]);
    await expect(integration.query(`INSERT INTO "StorefrontTemplateAssignment" ("storeId", "resourceType", "resourceId", "templateId", "updatedAt") VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`, ["store-a", "product", "product-a", "template-b"])).rejects.toBeTruthy();
  });

  it("allows the same page and blog handles in separate stores but not within one store", async () => {
    await integration.query(`INSERT INTO "StorePage" ("id", "storeId", "title", "handle", "content", "updatedAt") VALUES ($1, $2, $3, $4, $5::jsonb, CURRENT_TIMESTAMP)`, ["page-a", "store-a", "About", "about", "{}"]);
    await integration.query(`INSERT INTO "StorePage" ("id", "storeId", "title", "handle", "content", "updatedAt") VALUES ($1, $2, $3, $4, $5::jsonb, CURRENT_TIMESTAMP)`, ["page-b", "store-b", "About", "about", "{}"]);
    await expect(integration.query(`INSERT INTO "StorePage" ("id", "storeId", "title", "handle", "content", "updatedAt") VALUES ($1, $2, $3, $4, $5::jsonb, CURRENT_TIMESTAMP)`, ["page-a-duplicate", "store-a", "Again", "about", "{}"]))
      .rejects.toBeTruthy();

    await integration.query(`INSERT INTO "Blog" ("id", "storeId", "title", "handle", "updatedAt") VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`, ["blog-a", "store-a", "Journal", "journal"]);
    await integration.query(`INSERT INTO "Blog" ("id", "storeId", "title", "handle", "updatedAt") VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`, ["blog-b", "store-b", "Journal", "journal"]);
  });

  it("starts workspace generation and resource revisions at zero", async () => {
    const workspace = await integration.query<{ generation: number }>(`INSERT INTO "StorefrontWorkspace" ("storeId", "updatedAt") VALUES ($1, CURRENT_TIMESTAMP) RETURNING "generation"`, ["store-a"]);
    const template = await integration.query<{ revision: number }>(`INSERT INTO "StorefrontTemplate" ("id", "storeId", "type", "handle", "name", "layout", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6::jsonb, CURRENT_TIMESTAMP) RETURNING "revision"`, ["template-a", "store-a", "HOME", "default", "Home", JSON.stringify({ sections: [] })]);
    expect(workspace.rows[0]?.generation).toBe(0);
    expect(template.rows[0]?.revision).toBe(0);
  });
});
