import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { createPGliteDatabase, seedStore, type IntegrationDatabase } from "../../test/integration/pglite.js";
import { CatalogPostgresRepository } from "../catalog/postgres-repository.js";
import { CatalogService } from "../catalog/service.js";
import { CustomDataService } from "./service.js";
import { OwnerMetafieldService } from "./owner-values.js";
import { SqlCustomDataRepository } from "./sql-repository.js";

describe("custom fields on products and variants", () => {
  let database: IntegrationDatabase;
  let customData: CustomDataService;
  let owners: OwnerMetafieldService;
  let catalog: CatalogService;

  beforeEach(async () => {
    database = await createPGliteDatabase();
    for (const name of ["20260915120000_add_stripe_connect_commerce.sql", "20261020140329_store_settings_checkout.sql", "20261020163817_jelly_signature_customer_services.sql", "20260913220000_add_metafields.sql", "20260913230000_add_metaobjects.sql"]) {
      await database.exec(await readFile(new URL(`../../sql/migrations/${name}`, import.meta.url), "utf8"));
    }
    const repository = new SqlCustomDataRepository(database);
    customData = new CustomDataService(repository);
    owners = new OwnerMetafieldService(repository);
    const catalogRepository = new CatalogPostgresRepository(database);
    catalog = new CatalogService(catalogRepository, catalogRepository);
    await seedStore(database, "store-a", "store-a");
    await seedStore(database, "store-b", "store-b");
  });
  afterEach(async () => { await database.close(); });

  const define = (storeId: string, key: string, type: string, extra: Record<string, unknown> = {}) =>
    customData.createMetafieldDefinition(storeId, { ownerType: "product", namespace: "custom", key, name: key[0].toUpperCase() + key.slice(1), type: type as never, storefrontVisible: true, origin: "jelly", ...extra } as never);
  const tee = (storeId = "store-a") => catalog.createProduct(storeId, { handle: `tee-${storeId}`, title: "Tee", status: "ACTIVE", variants: [{ title: "S", priceMinor: 100 }, { title: "M", priceMinor: 100 }] });

  it("saves typed values, lists them, changes them and clears them", async () => {
    const material = await define("store-a", "material", "string");
    const rating = await define("store-a", "rating", "integer", { validations: { min: 1, max: 5 } });
    const organic = await define("store-a", "organic", "boolean");
    const care = await define("store-a", "care", "list:string");
    const product = await tee();

    expect(await owners.save("store-a", "product", product.id, { [material.id]: "Cotton", [rating.id]: 4, [organic.id]: true, [care.id]: ["Cold wash", "Line dry"] })).toEqual({ saved: 4, cleared: 0 });
    const byDefinition = async () => Object.fromEntries((await owners.list("store-a", "product", [product.id])).map((entry) => [entry.definitionId, entry.value]));
    expect(await byDefinition()).toEqual({ [material.id]: "Cotton", [rating.id]: 4, [organic.id]: true, [care.id]: ["Cold wash", "Line dry"] });

    expect(await owners.save("store-a", "product", product.id, { [material.id]: "Linen", [rating.id]: null })).toEqual({ saved: 1, cleared: 1 });
    expect(await byDefinition()).toEqual({ [material.id]: "Linen", [organic.id]: true, [care.id]: ["Cold wash", "Line dry"] });
  });

  it("leaves fields that are not mentioned alone", async () => {
    const material = await define("store-a", "material", "string");
    const origin = await define("store-a", "origin", "string");
    const product = await tee();
    await owners.save("store-a", "product", product.id, { [material.id]: "Cotton", [origin.id]: "Portugal" });
    await owners.save("store-a", "product", product.id, { [material.id]: "Linen" });
    const values = Object.fromEntries((await owners.list("store-a", "product", [product.id])).map((entry) => [entry.definitionId, entry.value]));
    expect(values).toEqual({ [material.id]: "Linen", [origin.id]: "Portugal" });
  });

  it("reports every problem at once and stores nothing when any value is wrong", async () => {
    const material = await define("store-a", "material", "string");
    const rating = await define("store-a", "rating", "integer", { validations: { min: 1, max: 5 } });
    const colour = await define("store-a", "colour", "color");
    const product = await tee();
    await owners.save("store-a", "product", product.id, { [material.id]: "Cotton" });

    const failure = await owners.save("store-a", "product", product.id, { [material.id]: "Linen", [rating.id]: 9, [colour.id]: "red" }).catch((error) => error);
    expect(failure).toMatchObject({ status: 422, code: "METAFIELD_INVALID" });
    expect(failure.issues.map((issue: { path: string }) => issue.path).sort()).toEqual([colour.id, rating.id].sort());
    expect(failure.issues.find((issue: { path: string }) => issue.path === rating.id).message).toBe("Rating: Enter 5 or less.");
    expect(failure.message).toBe("2 custom fields need attention.");

    const stored = await owners.list("store-a", "product", [product.id]);
    expect(stored).toEqual([expect.objectContaining({ definitionId: material.id, value: "Cotton" })]);
  });

  it("works for variants, and lists several variants in one call", async () => {
    const weave = await customData.createMetafieldDefinition("store-a", { ownerType: "variant", namespace: "custom", key: "weave", name: "Weave", type: "string", storefrontVisible: false, origin: "jelly" } as never);
    const product = await tee();
    const [small, medium] = product.variants;
    await owners.save("store-a", "variant", small.id, { [weave.id]: "Twill" });
    await owners.save("store-a", "variant", medium.id, { [weave.id]: "Plain" });
    const all = await owners.list("store-a", "variant", [small.id, medium.id, small.id]);
    expect(Object.fromEntries(all.map((entry) => [entry.ownerId, entry.value]))).toEqual({ [small.id]: "Twill", [medium.id]: "Plain" });
    expect(await owners.list("store-a", "variant", [])).toEqual([]);
  });

  it("will not mix owner types: a product field cannot be set on a variant", async () => {
    const material = await define("store-a", "material", "string");
    const product = await tee();
    await expect(owners.save("store-a", "variant", product.variants[0].id, { [material.id]: "Cotton" })).rejects.toMatchObject({ status: 422, code: "METAFIELD_INVALID" });
  });

  it("keeps stores apart", async () => {
    const material = await define("store-a", "material", "string");
    const foreign = await define("store-b", "material", "string");
    const mine = await tee("store-a");
    const theirs = await tee("store-b");
    await expect(owners.save("store-a", "product", theirs.id, { [material.id]: "x" })).rejects.toMatchObject({ status: 404, code: "METAFIELD_OWNER_NOT_FOUND" });
    await expect(owners.save("store-a", "product", mine.id, { [foreign.id]: "x" })).rejects.toMatchObject({ status: 422 });
    await owners.save("store-b", "product", theirs.id, { [foreign.id]: "Theirs" });
    expect(await owners.list("store-a", "product", [theirs.id])).toEqual([]);
  });

  it("stops listing a field once its definition is archived", async () => {
    const material = await define("store-a", "material", "string");
    const product = await tee();
    await owners.save("store-a", "product", product.id, { [material.id]: "Cotton" });
    await customData.archiveMetafieldDefinition("store-a", material.id);
    expect(await owners.list("store-a", "product", [product.id])).toEqual([]);
    await expect(owners.save("store-a", "product", product.id, { [material.id]: "Linen" })).rejects.toMatchObject({ status: 422 });
  });

  it("limits how much can be asked for or saved at once", async () => {
    const product = await tee();
    await expect(owners.list("store-a", "product", Array.from({ length: 201 }, (_, index) => `p${index}`))).rejects.toMatchObject({ code: "METAFIELD_OWNERS_LIMIT" });
    await expect(owners.save("store-a", "product", product.id, Object.fromEntries(Array.from({ length: 201 }, (_, index) => [`d${index}`, null])))).rejects.toMatchObject({ code: "METAFIELD_VALUES_LIMIT" });
  });

  it("is what storefront themes read: a saved value reaches the dynamic source resolver", async () => {
    const material = await define("store-a", "material", "string");
    const product = await tee();
    await owners.save("store-a", "product", product.id, { [material.id]: "Cotton" });
    const row = await customData.getMetafieldValue("store-a", material.id, product.id);
    expect(row?.value).toBe("Cotton");
  });
});

describe("definitions", () => {
  let database: IntegrationDatabase;
  let customData: CustomDataService;

  beforeEach(async () => {
    database = await createPGliteDatabase();
    for (const name of ["20260913220000_add_metafields.sql", "20260913230000_add_metaobjects.sql"]) {
      await database.exec(await readFile(new URL(`../../sql/migrations/${name}`, import.meta.url), "utf8"));
    }
    customData = new CustomDataService(new SqlCustomDataRepository(database));
    await seedStore(database, "store-a", "store-a");
  });
  afterEach(async () => { await database.close(); });

  const create = (extra: Record<string, unknown>) => customData.createMetafieldDefinition("store-a", { ownerType: "product", namespace: "custom", key: "material", name: "Material", type: "string", storefrontVisible: false, origin: "jelly", ...extra } as never);

  it("refuses rules that make no sense for the type", async () => {
    await expect(create({ type: "integer", validations: { maxLength: 5 } })).rejects.toMatchObject({ status: 422, code: "METAFIELD_RULES_INVALID" });
    await expect(create({ validations: { choices: [] } })).rejects.toMatchObject({ code: "METAFIELD_RULES_INVALID" });
    await expect(create({ type: "integer", validations: { min: 5, max: 1 } })).rejects.toMatchObject({ code: "METAFIELD_RULES_INVALID" });
    expect(await create({ type: "integer", validations: { min: 1, max: 5 } })).toMatchObject({ type: "integer" });
  });

  it("refuses a second definition with the same namespace and key", async () => {
    await create({});
    await expect(create({})).rejects.toMatchObject({ status: 409, code: "METAFIELD_EXISTS" });
    expect(await create({ key: "origin", name: "Origin" })).toMatchObject({ key: "origin" });
    expect(await create({ ownerType: "variant" })).toMatchObject({ ownerType: "variant" });
  });

  it("checks new rules when a definition is changed, and enforces them on the next value", async () => {
    const definition = await create({ type: "integer" });
    await expect(customData.updateMetafieldDefinition("store-a", definition.id, { validations: { maxLength: 3 } })).rejects.toMatchObject({ code: "METAFIELD_RULES_INVALID" });
    await customData.updateMetafieldDefinition("store-a", definition.id, { validations: { max: 10 } });
    await database.query(`INSERT INTO "Product" ("id","storeId","title","description","status","slug","updatedAt") VALUES ('p1','store-a','Tee','','ACTIVE','tee',CURRENT_TIMESTAMP)`);
    await expect(customData.setMetafieldValue("store-a", definition.id, "p1", 11)).rejects.toMatchObject({ status: 422, code: "METAFIELD_INVALID" });
    await customData.setMetafieldValue("store-a", definition.id, "p1", 10);
  });
});
