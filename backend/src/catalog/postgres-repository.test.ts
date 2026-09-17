import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createPGliteDatabase, seedStore, type IntegrationDatabase } from "../../test/integration/pglite.js";
import { CatalogPostgresRepository } from "./postgres-repository.js";

describe("PostgreSQL catalog repository", () => {
  let database: IntegrationDatabase;
  let repository: CatalogPostgresRepository;

  beforeEach(async () => {
    database = await createPGliteDatabase();
    repository = new CatalogPostgresRepository(database);
    await seedStore(database, "store-a", "store-a");
    await seedStore(database, "store-b", "store-b");
    await database.query(`INSERT INTO "Product" ("id", "storeId", "title", "description", "status", "slug", "updatedAt") VALUES ($1,$2,$3,$4,'ACTIVE',$5,CURRENT_TIMESTAMP)`, ["p1", "store-a", "Cake", "Fresh cake", "cake"]);
    await database.query(`INSERT INTO "ProductVariant" ("id", "storeId", "productId", "title", "sku", "priceMinor", "options", "updatedAt") VALUES ($1,$2,$3,$4,$5,$6,'{}',CURRENT_TIMESTAMP)`, ["v1", "store-a", "p1", "1 kg", "CAKE-1", 1200]);
    await database.query(`INSERT INTO "InventoryLevel" ("storeId", "variantId", "quantity", "reserved", "updatedAt") VALUES ($1,$2,4,1,CURRENT_TIMESTAMP)`, ["store-a", "v1"]);
  });

  afterEach(async () => { await database.close(); });

  it("lists active products with variants and availability scoped to the store", async () => {
    const result = await repository.listProducts("store-a", { limit: 50 });
    expect(result.nodes[0]).toMatchObject({ id: "p1", storeId: "store-a", title: "Cake", available: true });
    expect(result.nodes[0].variants[0]).toMatchObject({ id: "v1", priceMinor: 1200, quantity: 4, reserved: 1, available: true });
    await expect(repository.listProducts("store-b", { limit: 50 })).resolves.toMatchObject({ nodes: [] });
  });
});
