import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { createPGliteDatabase, seedStore, type IntegrationDatabase } from "../../test/integration/pglite.js";
import { CatalogPostgresRepository } from "./postgres-repository.js";
import { CatalogService } from "./service.js";
import { stockStatusOf } from "./types.js";

describe("stock status", () => {
  it("measures out and low against what is still available", () => {
    expect(stockStatusOf(false, null, 0, null)).toBe("untracked");
    expect(stockStatusOf(true, null, 0, null)).toBe("untracked");
    expect(stockStatusOf(true, 0, 0, null)).toBe("out");
    expect(stockStatusOf(true, 5, 5, null)).toBe("out");
    expect(stockStatusOf(true, 5, 2, null)).toBe("low");
    expect(stockStatusOf(true, 3, 0, null)).toBe("low");
    expect(stockStatusOf(true, 4, 0, null)).toBe("in_stock");
    expect(stockStatusOf(true, 8, 0, 10)).toBe("low");
    expect(stockStatusOf(true, 11, 0, 10)).toBe("in_stock");
    expect(stockStatusOf(true, 1, 0, 0)).toBe("in_stock");
  });
});

describe("inventory barcode, low-stock threshold and history", () => {
  let database: IntegrationDatabase;
  let repository: CatalogPostgresRepository;
  let service: CatalogService;

  beforeEach(async () => {
    database = await createPGliteDatabase();
    for (const name of ["20260915120000_add_stripe_connect_commerce.sql", "20261020140329_store_settings_checkout.sql", "20261020163817_jelly_signature_customer_services.sql"]) {
      await database.exec(await readFile(new URL(`../../sql/migrations/${name}`, import.meta.url), "utf8"));
    }
    repository = new CatalogPostgresRepository(database);
    service = new CatalogService(repository, repository);
    await seedStore(database, "store-a", "store-a");
    await seedStore(database, "store-b", "store-b");
  });
  afterEach(async () => { await database.close(); });

  async function createTee(storeId = "store-a", quantity = 10) {
    const product = await service.createProduct(storeId, { handle: `tee-${storeId}`, title: "Tee", status: "ACTIVE", variants: [{ title: "Standard", sku: `TEE-${storeId}`, priceMinor: 2500, quantity, barcode: "5012345678900", lowStockThreshold: 4 }] });
    return { product, variantId: product.variants[0].id };
  }
  const history = async (variantId: string, storeId = "store-a", limit = 50, cursor?: string) => service.listInventoryHistory(storeId, variantId, { limit, cursor });

  it("stores barcode and threshold, keeps them when a save omits them, and clears them with null", async () => {
    const { product, variantId } = await createTee();
    expect(product.variants[0]).toMatchObject({ barcode: "5012345678900", lowStockThreshold: 4 });
    const kept = await service.updateProduct("store-a", product.id, { variants: [{ id: variantId, title: "Standard", priceMinor: 2600 }] });
    expect(kept.variants[0]).toMatchObject({ priceMinor: 2600, barcode: "5012345678900", lowStockThreshold: 4 });
    const cleared = await service.updateProduct("store-a", product.id, { variants: [{ id: variantId, title: "Standard", priceMinor: 2600, barcode: null, lowStockThreshold: null }] });
    expect(cleared.variants[0]).toMatchObject({ barcode: null, lowStockThreshold: null });
  });

  it("records the starting stock and every sale, restock and manual change in order", async () => {
    const { variantId } = await createTee();
    // A checkout holds 3 units: reservations are not stock changes.
    await database.query(`UPDATE "InventoryLevel" SET "reserved"="reserved"+3 WHERE "storeId"='store-a' AND "variantId"=$1`, [variantId]);
    // Payment settles the hold: 3 units leave the shelf.
    await database.query(`UPDATE "InventoryLevel" SET "reserved"="reserved"-3,"quantity"="quantity"-3 WHERE "storeId"='store-a' AND "variantId"=$1`, [variantId]);
    // A cancelled order puts 1 back.
    await database.query(`UPDATE "InventoryLevel" SET "quantity"="quantity"+1 WHERE "storeId"='store-a' AND "variantId"=$1`, [variantId]);
    // Releasing an expired hold changes only the reservation.
    await database.query(`UPDATE "InventoryLevel" SET "reserved"="reserved"+1 WHERE "storeId"='store-a' AND "variantId"=$1`, [variantId]);
    await database.query(`UPDATE "InventoryLevel" SET "reserved"="reserved"-1 WHERE "storeId"='store-a' AND "variantId"=$1`, [variantId]);

    const { nodes } = await history(variantId);
    expect(nodes.map((entry) => [entry.reason, entry.quantityDelta, entry.quantityAfter])).toEqual([["restock", 1, 8], ["sale", -3, 7], ["initial", 10, 10]]);
    expect(nodes.every((entry) => entry.note === null && entry.actor === null)).toBe(true);
    expect(Number.isNaN(Date.parse(nodes[0].createdAt))).toBe(false);
  });

  it("records a manual change from the stock page with its note and who made it", async () => {
    const { variantId } = await createTee();
    const [row] = (await service.listInventory("store-a", { limit: 10 })).nodes;
    const saved = await service.updateInventory("store-a", variantId, { quantity: 14, expectedRevision: row.revision!, note: "  Recount after delivery  ", actor: "account-7" });
    expect(saved).toMatchObject({ quantity: 14, barcode: "5012345678900", lowStockThreshold: 4, stockStatus: "in_stock" });
    const [latest, initial] = (await history(variantId)).nodes;
    expect(latest).toMatchObject({ reason: "manual", quantityDelta: 4, quantityAfter: 14, note: "Recount after delivery", actor: "account-7" });
    expect(initial.reason).toBe("initial");

    // The note and actor belong to that one change only.
    await database.query(`UPDATE "InventoryLevel" SET "quantity"="quantity"-1 WHERE "storeId"='store-a' AND "variantId"=$1`, [variantId]);
    expect((await history(variantId)).nodes[0]).toMatchObject({ reason: "sale", note: null, actor: null });
  });

  it("does not log a stale or rejected stock-page change", async () => {
    const { variantId } = await createTee();
    const [row] = (await service.listInventory("store-a", { limit: 10 })).nodes;
    await expect(service.updateInventory("store-a", variantId, { quantity: 1, expectedRevision: "stale" })).rejects.toMatchObject({ code: "INVENTORY_CHANGED" });
    expect((await history(variantId)).nodes).toHaveLength(1);
    await database.query(`UPDATE "InventoryLevel" SET "reserved"=8 WHERE "storeId"='store-a' AND "variantId"=$1`, [variantId]);
    const [reservedRow] = (await service.listInventory("store-a", { limit: 10 })).nodes;
    await expect(service.updateInventory("store-a", variantId, { quantity: 5, expectedRevision: reservedRow.revision! })).rejects.toMatchObject({ code: "INVENTORY_RESERVED" });
    expect(row.stockStatus).toBe("in_stock");
    expect((await history(variantId)).nodes).toHaveLength(1);
  });

  it("records a stock change made in the product editor as manual", async () => {
    const { product, variantId } = await createTee();
    await service.updateProduct("store-a", product.id, { variants: [{ id: variantId, title: "Standard", priceMinor: 2500, quantity: 25 }] });
    expect((await history(variantId)).nodes[0]).toMatchObject({ reason: "manual", quantityDelta: 15, quantityAfter: 25, note: "Product editor" });
    // Saving the same quantity again is not a change.
    await service.updateProduct("store-a", product.id, { variants: [{ id: variantId, title: "Standard", priceMinor: 2500, quantity: 25 }] });
    expect((await history(variantId)).nodes).toHaveLength(2);
  });

  it("pages through history newest first and rejects bad cursors and other stores", async () => {
    const { variantId } = await createTee();
    for (let step = 0; step < 4; step += 1) await database.query(`UPDATE "InventoryLevel" SET "quantity"="quantity"+1 WHERE "storeId"='store-a' AND "variantId"=$1`, [variantId]);
    const first = await history(variantId, "store-a", 2);
    expect(first.nodes.map((entry) => entry.quantityAfter)).toEqual([14, 13]);
    expect(first.nextCursor).not.toBeNull();
    const second = await history(variantId, "store-a", 2, first.nextCursor!);
    expect(second.nodes.map((entry) => entry.quantityAfter)).toEqual([12, 11]);
    const last = await history(variantId, "store-a", 2, second.nextCursor!);
    expect(last.nodes.map((entry) => entry.quantityAfter)).toEqual([10]);
    expect(last.nextCursor).toBeNull();
    await expect(history(variantId, "store-a", 2, "1; DROP TABLE x")).rejects.toMatchObject({ code: "INVENTORY_HISTORY_CURSOR" });
    await expect(history(variantId, "store-b")).rejects.toMatchObject({ status: 404 });
  });

  it("keeps each store's history separate", async () => {
    const a = await createTee("store-a", 10);
    const b = await createTee("store-b", 20);
    expect((await history(a.variantId, "store-a")).nodes.map((entry) => entry.quantityAfter)).toEqual([10]);
    expect((await history(b.variantId, "store-b")).nodes.map((entry) => entry.quantityAfter)).toEqual([20]);
  });

  it("reports stock status against the threshold and finds variants by barcode", async () => {
    const { product, variantId } = await createTee("store-a", 10);
    await service.createProduct("store-a", { handle: "mug", title: "Mug", status: "ACTIVE", variants: [{ title: "Standard", sku: "MUG", priceMinor: 900, quantity: 2, barcode: "4006381333931" }] });
    const rows = (await service.listInventory("store-a", { limit: 10 })).nodes;
    expect(Object.fromEntries(rows.map((row) => [row.sku, row.stockStatus]))).toEqual({ "TEE-store-a": "in_stock", MUG: "low" });
    expect((await service.listInventory("store-a", { limit: 10, query: "4006381" })).nodes.map((row) => row.sku)).toEqual(["MUG"]);
    expect((await service.listProducts("store-a", { limit: 10, query: "5012345678900" })).nodes.map((entry) => entry.id)).toEqual([product.id]);
    await database.query(`UPDATE "InventoryLevel" SET "reserved"=7 WHERE "storeId"='store-a' AND "variantId"=$1`, [variantId]);
    expect((await service.listInventory("store-a", { limit: 10, query: "TEE" })).nodes[0].stockStatus).toBe("low");
  });

  it("shows the barcode to shoppers but never the low-stock threshold", async () => {
    await createTee();
    const [product] = (await service.listPublicProducts("store-a", { limit: 10 })).nodes;
    expect(product.variants[0]).toMatchObject({ barcode: "5012345678900" });
    expect(product.variants[0]).not.toHaveProperty("lowStockThreshold");
    expect(product.variants[0]).not.toHaveProperty("costMinor");
  });

  it("rejects an invalid threshold at the database", async () => {
    const { variantId } = await createTee();
    await expect(database.query(`UPDATE "ProductVariant" SET "lowStockThreshold"=-1 WHERE "id"=$1`, [variantId])).rejects.toThrow(/lowStockThreshold/);
    await expect(database.query(`UPDATE "ProductVariant" SET "barcode"=$2 WHERE "id"=$1`, [variantId, "x".repeat(65)])).rejects.toThrow(/barcode/);
  });
});
