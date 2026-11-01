import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { createPGliteDatabase, seedStore, type IntegrationDatabase } from "../../test/integration/pglite.js";
import { CatalogPostgresRepository } from "../catalog/postgres-repository.js";
import { CatalogService } from "../catalog/service.js";
import { AdminSummaryService } from "./service.js";

describe("dashboard low-stock list", () => {
  let database: IntegrationDatabase;
  let catalog: CatalogService;
  let admin: AdminSummaryService;

  beforeEach(async () => {
    database = await createPGliteDatabase();
    for (const name of ["20260915120000_add_stripe_connect_commerce.sql", "20261020140329_store_settings_checkout.sql", "20261020163817_jelly_signature_customer_services.sql"]) {
      await database.exec(await readFile(new URL(`../../sql/migrations/${name}`, import.meta.url), "utf8"));
    }
    const repository = new CatalogPostgresRepository(database);
    catalog = new CatalogService(repository, repository);
    admin = new AdminSummaryService({ transaction: (work: (tx: unknown) => unknown) => database.transaction((tx) => work({ query: (sql: string, values?: unknown[]) => tx.query(sql, values) })) } as never);
    await seedStore(database, "store-a", "store-a");
  });
  afterEach(async () => { await database.close(); });

  const add = (handle: string, variant: Record<string, unknown>, status: "ACTIVE" | "DRAFT" = "ACTIVE") =>
    catalog.createProduct("store-a", { handle, title: handle, status, variants: [{ title: "Standard", priceMinor: 1000, ...variant }] });

  it("lists tracked, active variants whose available stock reached their threshold, lowest first", async () => {
    await add("default-low", { quantity: 3 });
    await add("custom-low", { quantity: 10, lowStockThreshold: 12 });
    await add("plenty", { quantity: 10 });
    await add("zero-threshold-ok", { quantity: 1, lowStockThreshold: 0 });
    await add("untracked", { trackInventory: false });
    await add("draft-low", { quantity: 1 }, "DRAFT");
    const held = await add("held", { quantity: 5 });
    await database.query(`UPDATE "InventoryLevel" SET "reserved"=3 WHERE "storeId"='store-a' AND "variantId"=$1`, [held.variants[0].id]);

    const { lowStock } = await admin.getSummary("store-a");
    expect(lowStock.map((item) => item.title)).toEqual(["held", "default-low", "custom-low"]);
  });
});
