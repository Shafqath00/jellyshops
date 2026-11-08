import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { createPGliteDatabase, seedStore, type IntegrationDatabase } from "../../test/integration/pglite.js";
import { CatalogPostgresRepository } from "./postgres-repository.js";
import { CatalogService } from "./service.js";

const value = (id: string, label: string) => ({ id, label, priceAdjustmentMinor: 0, position: 0 });
const size = { id: "size", name: "Size", type: "variant", required: true, position: 0, values: [value("size-S", "Single"), value("size-D", "Double")] };
const variant = (label: string, valueId: string, quantity = 5) => ({ title: label, priceMinor: 10000, quantity, options: { size: valueId } });

describe("variant combinations stay unique", () => {
  let database: IntegrationDatabase;
  let service: CatalogService;

  beforeEach(async () => {
    database = await createPGliteDatabase();
    for (const name of ["20260915120000_add_stripe_connect_commerce.sql", "20261020140329_store_settings_checkout.sql", "20261020163817_jelly_signature_customer_services.sql"]) {
      await database.exec(await readFile(new URL(`../../sql/migrations/${name}`, import.meta.url), "utf8"));
    }
    const repository = new CatalogPostgresRepository(database);
    service = new CatalogService(repository, repository);
    await seedStore(database, "store-a", "store-a");
  });
  afterEach(async () => { await database.close(); });

  const bed = () => service.createProduct("store-a", { handle: "bed", title: "Bed", status: "ACTIVE", options: [size], inventoryOptionIds: ["size"], variants: [variant("Single", "size-S"), variant("Double", "size-D")] } as never);

  it("updates the existing combination when a save sends it again without its id", async () => {
    const product = await bed();
    const updated = await service.updateProduct("store-a", product.id, { variants: [variant("Single", "size-S", 9), variant("Double", "size-D", 2)] } as never);
    expect(updated.variants).toHaveLength(2);
    expect(updated.variants.map((item) => item.id).sort()).toEqual(product.variants.map((item) => item.id).sort());
    expect(updated.variants.find((item) => item.title === "Single")?.quantity).toBe(9);
  });

  it("refuses two versions with the same choices, with a plain message", async () => {
    await expect(service.createProduct("store-a", { handle: "bed-2", title: "Bed", options: [size], inventoryOptionIds: ["size"], variants: [variant("Single", "size-S"), variant("Single", "size-S")] } as never))
      .rejects.toMatchObject({ status: 422, code: "VARIANT_DUPLICATE", message: "Two versions have the same choices (Single). Remove one before saving." });
    const product = await bed();
    await expect(service.updateProduct("store-a", product.id, { variants: [{ ...variant("Double", "size-D"), id: product.variants[0].id }, variant("Double", "size-D")] } as never))
      .rejects.toMatchObject({ code: "VARIANT_DUPLICATE" });
  });
});
