import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { createPGliteDatabase, seedStore, type IntegrationDatabase } from "../../test/integration/pglite.js";
import { CatalogPostgresRepository } from "./postgres-repository.js";
import { CatalogService } from "./service.js";

describe("variant cost and unit pricing", () => {
  let database: IntegrationDatabase;
  let repository: CatalogPostgresRepository;

  beforeEach(async () => {
    database = await createPGliteDatabase();
    for (const name of ["20260915120000_add_stripe_connect_commerce.sql", "20261020140329_store_settings_checkout.sql", "20261020163817_jelly_signature_customer_services.sql"]) {
      await database.exec(await readFile(new URL(`../../sql/migrations/${name}`, import.meta.url), "utf8"));
    }
    repository = new CatalogPostgresRepository(database);
    await seedStore(database, "store-a", "store-a");
  });
  afterEach(async () => { await database.close(); });

  const unitPricing = { totalAmount: 500, totalUnit: "g", baseAmount: 100, baseUnit: "g" };

  it("stores cost and unit pricing on create, keeps them when an update omits them, and clears them on null", async () => {
    const created = await repository.createProduct("store-a", { handle: "tea", title: "Tea", variants: [{ title: "Standard", priceMinor: 1000, costMinor: 400, unitPricing }] });
    expect(created.variants[0]).toMatchObject({ costMinor: 400, unitPricing });
    const id = created.variants[0].id;

    const kept = await repository.updateProduct("store-a", created.id, { variants: [{ id, title: "Standard", priceMinor: 1200 }] });
    expect(kept.variants[0]).toMatchObject({ priceMinor: 1200, costMinor: 400, unitPricing });

    const cleared = await repository.updateProduct("store-a", created.id, { variants: [{ id, title: "Standard", priceMinor: 1200, costMinor: null, unitPricing: null }] });
    expect(cleared.variants[0]).toMatchObject({ costMinor: null, unitPricing: null });
  });

  it("never returns cost on the public product listing", async () => {
    await repository.createProduct("store-a", { handle: "tea", title: "Tea", status: "ACTIVE", variants: [{ title: "Standard", priceMinor: 1000, costMinor: 400 }] });
    const service = new CatalogService(repository, { transaction: (work: any) => work(repository) } as never);
    const page = await service.listPublicProducts("store-a", { limit: 10 });
    expect(page.nodes[0].variants[0]).not.toHaveProperty("costMinor");
    expect(page.nodes[0].variants[0].priceMinor).toBe(1000);
  });
});
