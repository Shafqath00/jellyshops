import { describe, expect, it } from "vitest";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import request from "supertest";
import type { CommerceDatabase, SqlExecutor } from "../../src/commerce/repository.js";
import { createApp } from "../../src/app.js";
import { CatalogPostgresRepository } from "../../src/catalog/postgres-repository.js";
import { CatalogService } from "../../src/catalog/service.js";
import type { AppConfig } from "../../src/config.js";
import { CustomDataService } from "../../src/custom-data/service.js";
import { SqlCustomDataRepository } from "../../src/custom-data/sql-repository.js";
import { createPGliteDatabase, seedStore } from "./pglite.js";

async function testConfig(): Promise<AppConfig> {
  const directory = await mkdtemp(path.join(tmpdir(), "jelly-binding-values-"));
  return {
    port: 3001, nodeEnv: "test", corsOrigins: ["http://localhost:3000"], trustProxy: false,
    authProvider: "development", mediaProvider: "local-files", dataDirectory: directory,
    uploadDirectory: path.join(directory, "uploads"), maxUploadBytes: 1024 * 1024, demoStoreId: "store-a",
  };
}

function transactionDatabase(database: Awaited<ReturnType<typeof createPGliteDatabase>>): CommerceDatabase {
  return {
    async transaction(work) {
      return database.transaction((tx) => work({ query: (sql, values) => tx.query(sql, values) } as SqlExecutor));
    },
  };
}

/** Goes through createApp so the routes are mounted the way the real server mounts them. */
describe("custom-field values through the application", () => {
  it("serves visible values to shoppers and signed-in editors, never hidden fields, and keeps drafts out of the public route", async () => {
    const database = await createPGliteDatabase();
    for (const file of ["20260913220000_add_metafields.sql", "20260913230000_add_metaobjects.sql"]) {
      await database.exec(await readFile(new URL(`../../sql/migrations/${file}`, import.meta.url), "utf8"));
    }
    await seedStore(database, "store-a", "store-a");
    await seedStore(database, "store-b", "store-b");
    await database.query(`INSERT INTO "Product" ("id", "storeId", "title", "slug", "status", "updatedAt") VALUES ('bed-live', 'store-a', 'Oak bed', 'oak-bed', 'ACTIVE', CURRENT_TIMESTAMP), ('bed-draft', 'store-a', 'Next season bed', 'next-bed', 'DRAFT', CURRENT_TIMESTAMP)`);

    const customData = new CustomDataService(new SqlCustomDataRepository(database));
    const shown = await customData.createMetafieldDefinition("store-a", { ownerType: "product", namespace: "custom", key: "firmness", name: "Firmness", type: "string", storefrontVisible: true, origin: "jelly" });
    const hidden = await customData.createMetafieldDefinition("store-a", { ownerType: "product", namespace: "custom", key: "supplier_cost", name: "Supplier cost", type: "string", storefrontVisible: false, origin: "jelly" });
    for (const id of ["bed-live", "bed-draft"]) {
      await customData.setMetafieldValue("store-a", shown.id, id, "Medium firm");
      await customData.setMetafieldValue("store-a", hidden.id, id, "£120");
    }

    const catalogRepository = new CatalogPostgresRepository(database);
    const app = createApp({
      config: await testConfig(),
      storefrontSql: database,
      commerceDatabase: transactionDatabase(database),
      catalogService: new CatalogService(catalogRepository, catalogRepository),
    });
    const auth = { Authorization: "Bearer jelly-demo-merchant" };
    const firmness = { kind: "metafield", resource: "product", namespace: "custom", key: "firmness" };
    const cost = { kind: "metafield", resource: "product", namespace: "custom", key: "supplier_cost" };
    const title = { kind: "resource_field", resource: "product", field: "title" };
    const storeName = { kind: "resource_field", resource: "store", field: "name" };
    const ask = (resourceId: string) => ({ resource: { type: "product", id: resourceId }, bindings: [firmness, cost, title, storeName] });
    const valuesOf = (response: request.Response) => response.body.values.map(({ value }: { value: unknown }) => value);

    const shopper = await request(app).post("/api/public/stores/store-a/storefront/binding-values").send(ask("bed-live"));
    expect(shopper.status).toBe(200);
    expect(valuesOf(shopper)).toEqual(["Medium firm", null, "Oak bed", "store-a"]);

    const shopperDraft = await request(app).post("/api/public/stores/store-a/storefront/binding-values").send(ask("bed-draft"));
    expect(valuesOf(shopperDraft)).toEqual([null, null, null, "store-a"]);

    const editorDraft = await request(app).post("/api/stores/store-a/storefront/binding-values").set(auth).send(ask("bed-draft"));
    expect(editorDraft.status).toBe(200);
    expect(valuesOf(editorDraft)).toEqual(["Medium firm", null, "Next season bed", "store-a"]);

    // Another store's product id gives nothing, and the editor route needs a signed-in merchant.
    const otherStore = await request(app).post("/api/public/stores/store-b/storefront/binding-values").send(ask("bed-live"));
    expect(valuesOf(otherStore)).toEqual([null, null, null, "store-b"]);
    expect((await request(app).post("/api/stores/store-a/storefront/binding-values").send(ask("bed-live"))).status).toBe(401);
    await database.close();
  }, 60_000);
});
