import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CatalogPostgresRepository } from "../../src/catalog/postgres-repository.js";
import { CatalogService, type CatalogAdmin } from "../../src/catalog/service.js";
import { IMPORT_CHUNK, ProductBulkService } from "../../src/catalog-bulk/service.js";
import { headerRow, parseCsv, toCsv, toXlsx, type ColumnKey } from "../../src/catalog-bulk/sheet.js";
import { createPGliteDatabase, seedStore, type IntegrationDatabase } from "./pglite.js";

const HEAD: ColumnKey[] = ["handle", "title", "status", "vendor", "tags", "option1Name", "option1Value", "sku", "price", "compareAtPrice", "stock"];
const file = (rows: Array<Partial<Record<ColumnKey, string>>>) => Buffer.from(toCsv([
  ["Handle", "Title", "Status", "Brand", "Tags", "Option 1 name", "Option 1 value", "SKU", "Price", "Compare-at price", "Stock"],
  ...rows.map((row) => HEAD.map((key) => row[key] ?? "")),
]), "utf8");

describe("product import and export", () => {
  let database: IntegrationDatabase;
  let catalog: CatalogAdmin;
  let bulk: ProductBulkService;
  let clock = Date.parse("2026-11-13T10:00:00Z");

  beforeEach(async () => {
    database = await createPGliteDatabase();
    // Product saving needs these later migrations too (the catalogue repository tests load the same ones).
    for (const name of ["20260915120000_add_stripe_connect_commerce.sql", "20261020140329_store_settings_checkout.sql", "20261020163817_jelly_signature_customer_services.sql", "20261101000000_collection_description_document.sql"]) {
      await database.exec(await readFile(new URL(`../../sql/migrations/${name}`, import.meta.url), "utf8"));
    }
    await seedStore(database, "store-a", "store-a");
    await seedStore(database, "store-b", "store-b");
    const repository = new CatalogPostgresRepository(database);
    catalog = new CatalogService(repository, repository) as unknown as CatalogAdmin;
    bulk = new ProductBulkService(database, catalog, () => clock);
  });
  afterEach(async () => { await database.close(); });

  const runToEnd = async (id: string) => { let view = await bulk.run("store-a", id); let turns = 1; while (view.status !== "finished") { view = await bulk.run("store-a", id); turns++; } return { view, turns }; };
  const handles = async (storeId = "store-a") => (await catalog.listProducts(storeId, { limit: 100 })).nodes.map((product) => product.handle).sort();

  it("uploads, checks without saving, imports, and re-imports as updates with no copies", async () => {
    const uploaded = await bulk.upload("store-a", "user-1", "beds.csv", file([
      { handle: "oak-bed", title: "Oak bed", status: "active", vendor: "Harbour", tags: "oak, bedroom", option1Name: "Size", option1Value: "Double", sku: "OAK-D", price: "499.00", compareAtPrice: "599", stock: "5" },
      { handle: "oak-bed", option1Value: "King", sku: "OAK-K", price: "579", stock: "2" },
      { handle: "tote", title: "Linen tote", price: "24", sku: "TOTE" },
      { handle: "broken", title: "Broken", price: "lots" },
    ]));
    expect(uploaded).toMatchObject({ status: "uploaded", rowCount: 4, format: "csv" });
    expect(uploaded.mapping).toMatchObject({ handle: 0, title: 1, vendor: 3, sku: 7, price: 8, compareAtPrice: 9, stock: 10 });

    const checked = await bulk.check("store-a", uploaded.id, uploaded.mapping, "upsert");
    expect(checked.summary).toMatchObject({ products: 3, create: 2, problem: 1, rows: 4 });
    expect(checked.problems).toEqual([expect.objectContaining({ row: 5, column: "Price", handle: "broken" })]);
    expect(await handles()).toEqual([]);

    const { view } = await runToEnd(uploaded.id);
    expect(view.counts).toEqual({ created: 2, updated: 0, skipped: 0, failed: 1 });
    expect(view.progress).toEqual({ done: 3, total: 3 });
    expect(await handles()).toEqual(["oak-bed", "tote"]);
    const [oak] = await catalog.findProducts("store-a", { handles: ["oak-bed"] });
    expect(oak).toMatchObject({ title: "Oak bed", status: "ACTIVE", vendor: "Harbour", tags: ["oak", "bedroom"] });
    expect(oak.variants.map((variant) => [variant.title, variant.sku, variant.priceMinor, variant.quantity]).sort()).toEqual([["Double", "OAK-D", 49900, 5], ["King", "OAK-K", 57900, 2]]);

    const report = await bulk.report("store-a", uploaded.id);
    expect(report).toEqual([["Row", "Handle", "Product", "Column", "What happened", "Reason"], ["5", "broken", "Broken", "Price", "Not imported", expect.stringMatching(/^Price is not a price/)]]);

    // The same file again changes the price of one item and creates nothing new.
    const again = await bulk.upload("store-a", "user-1", "beds-2.csv", file([{ handle: "oak-bed", sku: "OAK-D", price: "450", stock: "9" }, { handle: "tote", title: "Linen tote bag", price: "26", sku: "TOTE" }]));
    await bulk.check("store-a", again.id, again.mapping, "upsert");
    const second = await runToEnd(again.id);
    expect(second.view.counts).toEqual({ created: 0, updated: 2, skipped: 0, failed: 0 });
    expect(await handles()).toEqual(["oak-bed", "tote"]);
    const [changed] = await catalog.findProducts("store-a", { handles: ["oak-bed"] });
    expect(changed.variants.find((variant) => variant.sku === "OAK-D")).toMatchObject({ priceMinor: 45000, quantity: 9 });
    expect(changed.variants.find((variant) => variant.sku === "OAK-K")).toMatchObject({ priceMinor: 57900, quantity: 2 });
    // Brand and tags were in the file's columns but left empty on a row with no product details of its own: they are cleared, as documented.
    expect((await bulk.list("store-a")).map((entry) => entry.fileName)).toEqual(["beds-2.csv", "beds.csv"]);
  });

  it("works in steps and can be carried on after an interruption", async () => {
    const many = Array.from({ length: IMPORT_CHUNK * 2 + 5 }, (_, index) => ({ handle: `item-${index + 1}`, title: `Item ${index + 1}`, price: "5", sku: `SKU-${index + 1}` }));
    const uploaded = await bulk.upload("store-a", "user-1", "many.csv", file(many));
    await bulk.check("store-a", uploaded.id, uploaded.mapping, "create");
    const first = await bulk.run("store-a", uploaded.id);
    expect(first).toMatchObject({ status: "running", progress: { done: IMPORT_CHUNK, total: many.length } });
    expect(await handles()).toHaveLength(IMPORT_CHUNK);
    // A product from the next step is saved, then the browser tab closes before the step is recorded.
    await catalog.createProduct("store-a", { handle: `item-${IMPORT_CHUNK + 1}`, title: "Saved early", variants: [{ title: "Standard", priceMinor: 500, sku: `SKU-${IMPORT_CHUNK + 1}` }] });
    const { view, turns } = await runToEnd(uploaded.id);
    expect(turns).toBe(2);
    expect(view.counts).toEqual({ created: many.length - 1, updated: 0, skipped: 1, failed: 0 });
    expect(await handles()).toHaveLength(many.length);
    // Running a finished import again does nothing.
    expect(await bulk.run("store-a", uploaded.id)).toMatchObject({ status: "finished", counts: view.counts });
    expect(await handles()).toHaveLength(many.length);
  });

  it("keeps stores apart", async () => {
    const uploaded = await bulk.upload("store-a", "user-1", "a.csv", file([{ handle: "tote", title: "Tote", price: "5", sku: "SHARED" }]));
    await expect(bulk.get("store-b", uploaded.id)).rejects.toMatchObject({ status: 404 });
    await expect(bulk.check("store-b", uploaded.id, uploaded.mapping, "upsert")).rejects.toMatchObject({ status: 404 });
    await expect(bulk.run("store-b", uploaded.id)).rejects.toMatchObject({ status: 404 });
    await expect(bulk.undo("store-b", uploaded.id)).rejects.toMatchObject({ status: 404 });
    expect(await bulk.list("store-b")).toEqual([]);
    // A SKU used in another store is no obstacle, and nothing lands in the wrong store.
    await catalog.createProduct("store-b", { handle: "tote", title: "Their tote", variants: [{ title: "Standard", priceMinor: 900, sku: "SHARED" }] });
    await bulk.check("store-a", uploaded.id, uploaded.mapping, "upsert");
    expect((await runToEnd(uploaded.id)).view.counts.created).toBe(1);
    expect((await catalog.findProducts("store-b", { handles: ["tote"] }))[0].title).toBe("Their tote");
  });

  it("must be checked before it runs, and its settings are fixed once it has started", async () => {
    const uploaded = await bulk.upload("store-a", "user-1", "a.csv", file([{ handle: "tote", title: "Tote", price: "5" }]));
    await expect(bulk.run("store-a", uploaded.id)).rejects.toMatchObject({ code: "IMPORT_NOT_CHECKED" });
    await expect(bulk.check("store-a", uploaded.id, {}, "upsert")).rejects.toMatchObject({ code: "IMPORT_NO_KEY" });
    await bulk.check("store-a", uploaded.id, uploaded.mapping, "upsert");
    await runToEnd(uploaded.id);
    await expect(bulk.check("store-a", uploaded.id, uploaded.mapping, "create")).rejects.toMatchObject({ code: "IMPORT_STARTED" });
  });

  it("undoes an import: new products are archived and changed values put back, but not stock", async () => {
    await catalog.createProduct("store-a", { handle: "oak-bed", title: "Oak bed", vendor: "Harbour", status: "ACTIVE", variants: [{ title: "Standard", priceMinor: 49900, sku: "OAK", quantity: 5, trackInventory: true }] });
    const uploaded = await bulk.upload("store-a", "user-1", "a.csv", file([{ handle: "oak-bed", title: "Oak bed frame", vendor: "Linden", sku: "OAK", price: "450", stock: "9" }, { handle: "new-one", title: "New one", price: "5" }]));
    await bulk.check("store-a", uploaded.id, uploaded.mapping, "upsert");
    const { view } = await runToEnd(uploaded.id);
    expect(view.canUndo).toBe(true);
    const undone = await bulk.undo("store-a", uploaded.id);
    expect(undone).toMatchObject({ status: "undone", canUndo: false, undone: { archived: 1, restored: 1, failed: 0 } });
    const [oak] = await catalog.findProducts("store-a", { handles: ["oak-bed"] });
    expect(oak).toMatchObject({ title: "Oak bed", vendor: "Harbour" });
    expect(oak.variants[0]).toMatchObject({ priceMinor: 49900, quantity: 9 });
    expect((await catalog.findProducts("store-a", { handles: ["new-one"] }))[0].status).toBe("ARCHIVED");
    await expect(bulk.undo("store-a", uploaded.id)).rejects.toMatchObject({ code: "IMPORT_NOT_FINISHED" });
  });

  it("stops offering undo after 30 days and limits how often files can be uploaded", async () => {
    const uploaded = await bulk.upload("store-a", "user-1", "a.csv", file([{ handle: "tote", title: "Tote", price: "5" }]));
    await bulk.check("store-a", uploaded.id, uploaded.mapping, "upsert");
    await runToEnd(uploaded.id);
    await database.query(`UPDATE "ProductImport" SET "finishedAt" = $2 WHERE "id" = $1`, [uploaded.id, new Date(clock - 31 * 24 * 60 * 60 * 1000).toISOString()]);
    expect((await bulk.get("store-a", uploaded.id)).canUndo).toBe(false);
    await expect(bulk.undo("store-a", uploaded.id)).rejects.toMatchObject({ code: "IMPORT_TOO_OLD" });
    for (let count = 0; count < 9; count++) await bulk.upload("store-a", "user-1", "a.csv", file([{ handle: "x", title: "X", price: "5" }]));
    await expect(bulk.upload("store-a", "user-1", "a.csv", file([{ handle: "x", title: "X", price: "5" }]))).rejects.toMatchObject({ status: 429 });
    clock += 11 * 60 * 1000;
    await expect(bulk.upload("store-a", "user-1", "a.csv", file([{ handle: "x", title: "X", price: "5" }]))).resolves.toMatchObject({ status: "uploaded" });
  });

  it("exports all, filtered or chosen products in the template's columns, as CSV or Excel", async () => {
    const a = await catalog.createProduct("store-a", { handle: "oak-bed", title: "Oak bed", productType: "Beds", status: "ACTIVE", variants: [{ title: "Standard", priceMinor: 49900, sku: "=OAK" }] });
    await catalog.createProduct("store-a", { handle: "lamp", title: "Lamp", productType: "Lighting", status: "DRAFT", variants: [{ title: "Standard", priceMinor: 2500 }] });
    await catalog.createProduct("store-b", { handle: "other", title: "Other store", variants: [{ title: "Standard", priceMinor: 100 }] });
    const all = await bulk.exportTable("store-a", {});
    expect(all.table[0]).toEqual(headerRow());
    expect(all.table.slice(1).map((row) => row[0])).toEqual(["lamp", "oak-bed"]);
    expect((await bulk.exportTable("store-a", { productType: "beds" })).table.slice(1).map((row) => row[0])).toEqual(["oak-bed"]);
    expect((await bulk.exportTable("store-a", { status: "DRAFT" })).table.slice(1).map((row) => row[0])).toEqual(["lamp"]);
    expect((await bulk.exportTable("store-a", { ids: [a.id, "someone-elses"] })).products).toBe(1);
    const csvFile = await bulk.file(all.table, "csv");
    expect(csvFile.body.toString("utf8")).toContain("\"'=OAK\"");
    expect(parseCsv(csvFile.body).rows.find((row) => row[0] === "oak-bed")).toContain("=OAK");
    const excel = await bulk.file(all.table, "xlsx");
    expect(excel.extension).toBe("xlsx");
    expect(excel.body.subarray(0, 2).toString()).toBe("PK");
  });

  it("reads an Excel upload", async () => {
    const buffer = await toXlsx([["Handle", "Title", "Price", "SKU"], ["tote", "Linen tote", "24.00", "00123"]], { sheetName: "Products" });
    const uploaded = await bulk.upload("store-a", "user-1", "products.xlsx", buffer);
    expect(uploaded).toMatchObject({ format: "xlsx", rowCount: 1, headers: ["Handle", "Title", "Price", "SKU"] });
    await bulk.check("store-a", uploaded.id, uploaded.mapping, "upsert");
    await runToEnd(uploaded.id);
    expect((await catalog.findProducts("store-a", { handles: ["tote"] }))[0].variants[0]).toMatchObject({ sku: "00123", priceMinor: 2400 });
  });
  it("carries on in the background once the page has gone quiet, and leaves a live import alone", async () => {
    const many = Array.from({ length: IMPORT_CHUNK + 3 }, (_, index) => ({ handle: `bg-${index + 1}`, title: `Background ${index + 1}`, price: "5" }));
    const uploaded = await bulk.upload("store-a", "user-1", "bg.csv", file(many));
    await bulk.check("store-a", uploaded.id, uploaded.mapping, "create");
    await bulk.run("store-a", uploaded.id);
    // The merchant's page called a moment ago: the worker does not touch it.
    expect(await bulk.continueStalled()).toEqual({ continued: 0, finished: 0 });
    expect(await handles()).toHaveLength(IMPORT_CHUNK);
    // Two minutes of silence: the worker takes the next step and finishes it.
    await database.query(`UPDATE "ProductImport" SET "updatedAt" = NOW() - INTERVAL '2 minutes' WHERE "id" = $1`, [uploaded.id]);
    expect(await bulk.continueStalled()).toEqual({ continued: 1, finished: 1 });
    expect(await handles()).toHaveLength(many.length);
    expect(await bulk.get("store-a", uploaded.id)).toMatchObject({ status: "finished", counts: { created: many.length, updated: 0, skipped: 0, failed: 0 } });
    // Nothing is left to carry on, and checked-but-not-started imports are never started by the worker.
    const waiting = await bulk.upload("store-a", "user-1", "later.csv", file([{ handle: "later", title: "Later", price: "5" }]));
    await bulk.check("store-a", waiting.id, waiting.mapping, "create");
    await database.query(`UPDATE "ProductImport" SET "updatedAt" = NOW() - INTERVAL '2 minutes' WHERE "id" = $1`, [waiting.id]);
    expect(await bulk.continueStalled()).toEqual({ continued: 0, finished: 0 });
    expect(await handles()).not.toContain("later");
  });
});
