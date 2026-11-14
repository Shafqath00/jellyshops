import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { createPGliteDatabase, seedStore, type IntegrationDatabase } from "../../test/integration/pglite.js";
import { CatalogPostgresRepository } from "./postgres-repository.js";

describe("product list filters and facets", () => {
  let database: IntegrationDatabase;
  let repository: CatalogPostgresRepository;

  const product = (id: string, storeId: string, title: string, type: string | null, vendor: string | null, tags: string[], status = "ACTIVE") => database.query(
    `INSERT INTO "Product" ("id","storeId","title","description","status","slug","productType","vendor","tags","updatedAt") VALUES ($1,$2,$3,'',$4::"ProductStatus",$5,$6,$7,$8,CURRENT_TIMESTAMP)`,
    [id, storeId, title, status, id, type, vendor, tags]);

  beforeEach(async () => {
    database = await createPGliteDatabase();
    for (const file of ["20260915120000_add_stripe_connect_commerce.sql", "20261020140329_store_settings_checkout.sql", "20261020163817_jelly_signature_customer_services.sql", "20261101000000_collection_description_document.sql"]) {
      await database.exec(await readFile(new URL(`../../sql/migrations/${file}`, import.meta.url), "utf8"));
    }
    repository = new CatalogPostgresRepository(database);
    await seedStore(database, "store-a", "store-a");
    await seedStore(database, "store-b", "store-b");
    await product("a1", "store-a", "Oak bed", "Beds", "Harbour", ["Oak", "bedroom"]);
    await product("a2", "store-a", "Pine bed", "beds", "Linden", ["pine", "Bedroom"]);
    await product("a3", "store-a", "Old lamp", " Lighting ", null, [], "ARCHIVED");
    await product("a4", "store-a", "Plain box", null, "", []);
    await product("b1", "store-b", "Other shop bed", "Sofas", "Secret", ["hidden"]);
  });

  afterEach(async () => { await database.close(); });

  const ids = async (input: Record<string, string>) => (await repository.listProducts("store-a", { limit: 50, ...input })).nodes.map((item) => item.id).sort();

  it("filters by type, brand and tag without regard to case, inside one store", async () => {
    expect(await ids({ productType: "BEDS" })).toEqual(["a1", "a2"]);
    expect(await ids({ vendor: "harbour" })).toEqual(["a1"]);
    expect(await ids({ tag: "bedroom" })).toEqual(["a1", "a2"]);
    expect(await ids({ tag: "oak", productType: "Beds" })).toEqual(["a1"]);
    expect(await ids({ vendor: "Secret" })).toEqual([]);
    expect(await ids({ tag: "hidden" })).toEqual([]);
  });

  it("combines with the status filter", async () => {
    expect(await ids({ productType: "lighting" })).toEqual([]);
    expect((await repository.listProducts("store-a", { limit: 50, status: "ARCHIVED" })).nodes.map((item) => item.id)).toEqual(["a3"]);
  });

  it("lists the types, brands and tags one store uses, once each, trimmed and A to Z", async () => {
    const facets = await repository.listProductFacets("store-a");
    expect(facets.productTypes.map((value) => value.toLowerCase())).toEqual(["beds", "lighting"]);
    expect(facets.vendors).toEqual(["Harbour", "Linden"]);
    expect(facets.tags.map((value) => value.toLowerCase())).toEqual(["bedroom", "oak", "pine"]);
    expect(await repository.listProductFacets("store-b")).toEqual({ productTypes: ["Sofas"], vendors: ["Secret"], tags: ["hidden"] });
  });
});
