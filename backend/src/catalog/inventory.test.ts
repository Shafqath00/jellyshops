import { beforeEach, afterEach, expect, it } from "vitest";
import { createPGliteDatabase, seedStore, type IntegrationDatabase } from "../../test/integration/pglite.js";
import { CatalogPostgresRepository } from "./postgres-repository.js";
let db: IntegrationDatabase;
let repository: CatalogPostgresRepository;
beforeEach(async () => {
  db = await createPGliteDatabase();
  await seedStore(db, "a", "a"); await seedStore(db, "b", "b");
  await db.query(`INSERT INTO "Product" ("id","storeId","title","slug","updatedAt") VALUES ('p','a','Tee','tee',CURRENT_TIMESTAMP)`);
  await db.query(`INSERT INTO "ProductVariant" ("id","storeId","productId","title","sku","priceMinor","trackInventory","options","updatedAt") VALUES ('v','a','p','Small','TEE-S',1200,true,'{}',CURRENT_TIMESTAMP)`);
  await db.query(`INSERT INTO "InventoryLevel" ("storeId","variantId","quantity","reserved","updatedAt") VALUES ('a','v',10,2,CURRENT_TIMESTAMP)`);
  repository = new CatalogPostgresRepository(db);
});
afterEach(async () => { await db.close(); });
it("lists stock with tenant isolation and SKU search", async () => {
  const page = await repository.listInventory("a", { query: "TEE-S", limit: 10 });
  expect(page.nodes[0]).toMatchObject({ variantId: "v", quantity: 10, reserved: 2, availableQuantity: 8 });
  expect((await repository.listInventory("b", { limit: 10 })).nodes).toEqual([]);
});
it("protects reserved stock and rejects concurrent stale edits", async () => {
  const row = (await repository.listInventory("a", { limit: 10 })).nodes[0];
  await expect(repository.updateInventory("a", "v", { quantity: 1, expectedRevision: row.revision! })).rejects.toMatchObject({ code: "INVENTORY_RESERVED" });
  const saved = await repository.updateInventory("a", "v", { quantity: 12, expectedRevision: row.revision! });
  expect(saved.availableQuantity).toBe(10);
  await expect(repository.updateInventory("a", "v", { quantity: 14, expectedRevision: row.revision! })).rejects.toMatchObject({ code: "INVENTORY_CHANGED" });
  await expect(repository.updateInventory("b", "v", { quantity: 14, expectedRevision: saved.revision! })).rejects.toMatchObject({ status: 404 });
});
