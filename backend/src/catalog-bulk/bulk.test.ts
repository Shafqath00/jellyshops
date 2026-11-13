import { describe, expect, it } from "vitest";
import type { CatalogCollection, CatalogProduct } from "../catalog/types.js";
import { countPlans, planImport, type StoreSnapshot } from "./plan.js";
import {
  SHEET_COLUMNS, cleanMapping, guardCell, headerRow, parseCsv, parseList, parseMoney, parseSheetFile, parseStatus, parseWholeNumber, parseYesNo,
  productToRows, slugify, suggestMapping, templateTable, toCsv, toXlsx, unguardCell, type ColumnKey,
} from "./sheet.js";

const csv = (text: string) => Buffer.from(text, "utf8");

describe("reading spreadsheet files", () => {
  it("reads CSV with a BOM, semicolons, quoted line breaks and blank rows", () => {
    const sheet = parseCsv(csv("﻿Title;Price;Description\r\n\r\n\"Oak bed\";499,50;\"Solid oak\nwith slats\"\r\n;;\r\n  Pine bed ;299;\r\n"));
    expect(sheet.headers).toEqual(["Title", "Price", "Description"]);
    expect(sheet.rows).toEqual([["Oak bed", "499,50", "Solid oak\nwith slats"], ["Pine bed", "299", ""]]);
  });

  it("reads tab-separated text and pads short rows", () => {
    expect(parseCsv(csv("Title\tSKU\tPrice\nBed\tB1\n")).rows).toEqual([["Bed", "B1", ""]]);
  });

  it("says plainly when a file is empty, has no rows, or has too many", () => {
    expect(() => parseCsv(csv("\n\n"))).toThrow(/empty/);
    expect(() => parseCsv(csv("Title,Price\n"))).toThrow(/no products/);
    expect(() => parseCsv(csv("Title\n" + "x\n".repeat(5001)))).toThrow(/5,001 rows/);
  });

  it("round-trips an Excel file and keeps long numbers and leading zeros", async () => {
    const buffer = await toXlsx([["SKU", "Barcode", "Price"], ["00123", "5012345678900", "499.50"]], { sheetName: "Products", guide: true });
    const sheet = await parseSheetFile("products.xlsx", buffer);
    expect(sheet.format).toBe("xlsx");
    expect(sheet.rows).toEqual([["00123", "5012345678900", "499.50"]]);
  });

  it("refuses files that are too large or in the old Excel format", async () => {
    await expect(parseSheetFile("big.csv", Buffer.alloc(5 * 1024 * 1024 + 1, 97))).rejects.toThrow(/larger than 5 MB/);
    await expect(parseSheetFile("old.xls", Buffer.from([0xd0, 0xcf, 0x11, 0xe0]))).rejects.toThrow(/\.xls/);
  });
});

describe("cells", () => {
  it("reads prices the way people type them", () => {
    expect(parseMoney("499")).toEqual({ ok: true, value: 49900 });
    expect(parseMoney("£1,299.50")).toEqual({ ok: true, value: 129950 });
    expect(parseMoney("499,5")).toEqual({ ok: true, value: 49950 });
    expect(parseMoney(" 12.3 GBP")).toEqual({ ok: true, value: 1230 });
    expect(parseMoney("")).toEqual({ ok: true, value: null });
    expect(parseMoney("-5").ok).toBe(false);
    expect(parseMoney("call us").ok).toBe(false);
    expect(parseMoney("4.999").ok).toBe(false);
  });

  it("reads whole numbers, yes/no, status words and lists", () => {
    expect(parseWholeNumber("1,200")).toEqual({ ok: true, value: 1200 });
    expect(parseWholeNumber("12.0")).toEqual({ ok: true, value: 12 });
    expect(parseWholeNumber("2.5").ok).toBe(false);
    expect(parseWholeNumber("-1").ok).toBe(false);
    expect(parseYesNo("Yes")).toEqual({ ok: true, value: true });
    expect(parseYesNo("FALSE")).toEqual({ ok: true, value: false });
    expect(parseYesNo("maybe").ok).toBe(false);
    expect(parseStatus("Active")).toEqual({ ok: true, value: "ACTIVE" });
    expect(parseStatus("hidden").ok).toBe(false);
    expect(parseList(" oak , Oak,, bedroom ", ",")).toEqual(["oak", "bedroom"]);
    expect(slugify("Oak Bed Frame (King) é")).toBe("oak-bed-frame-king-e");
  });

  it("stops formulas on export and undoes it on import", () => {
    for (const value of ["=SUM(A1)", "+44 20 7946", "-5", "@handle", "\tTab"]) {
      expect(guardCell(value)).toBe(`'${value}`);
      expect(unguardCell(guardCell(value))).toBe(value);
    }
    expect(guardCell("Oak bed")).toBe("Oak bed");
    expect(unguardCell("'quoted' name")).toBe("'quoted' name");
    const file = toCsv([["Title"], ["=cmd|' /C calc'!A0"], ['He said "hi"']]);
    expect(file).toContain("\"'=cmd|' /C calc'!A0\"");
    expect(file).toContain('"He said ""hi"""');
    expect(parseCsv(csv(file)).rows[0]).toEqual(["=cmd|' /C calc'!A0"]);
  });
});

describe("matching columns", () => {
  it("matches headings whatever their case or punctuation, and common other names", () => {
    const mapping = suggestMapping(["Product Name", "variant_sku", "VENDOR", "Compare At Price", "Qty", "Colour of box", "Price"]);
    expect(mapping).toEqual({ title: 0, sku: 1, vendor: 2, compareAtPrice: 3, stock: 4, price: 6 });
  });

  it("matches every column of our own template", () => {
    const mapping = suggestMapping(headerRow());
    expect(Object.keys(mapping).sort()).toEqual(SHEET_COLUMNS.map((column) => column.key).sort());
  });

  it("drops anything odd from a mapping sent by the browser", () => {
    expect(cleanMapping({ title: 0, price: 0, sku: 9, nonsense: 1, stock: 1.5, handle: 2 }, 3)).toEqual({ title: 0, handle: 2 });
  });
});

// ---- Planning

const HEAD: ColumnKey[] = ["handle", "title", "status", "vendor", "collections", "tags", "option1Name", "option1Value", "sku", "price", "compareAtPrice", "stock", "trackStock"];
const mapping = Object.fromEntries(HEAD.map((key, index) => [key, index]));
const line = (values: Partial<Record<ColumnKey, string>>) => HEAD.map((key) => values[key] ?? "");
const collection = (id: string, title: string): CatalogCollection => ({ id, storeId: "s", externalId: null, handle: slugify(title), title, description: "", productIds: [] });
const product = (overrides: Partial<CatalogProduct> = {}): CatalogProduct => ({
  id: "p1", storeId: "s", externalId: null, handle: "oak-bed", title: "Oak bed", description: "Old", specifications: {}, vendor: "Harbour", productType: "Beds", tags: ["oak"], status: "ACTIVE", media: [],
  variants: [
    { id: "v1", productId: "p1", externalId: null, title: "Double", sku: "OAK-D", priceMinor: 49900, compareAtPriceMinor: 59900, options: { size: "double" }, trackInventory: true, quantity: 5, reserved: 0, available: true },
    { id: "v2", productId: "p1", externalId: null, title: "King", sku: null, priceMinor: 57900, compareAtPriceMinor: null, options: { size: "king" }, trackInventory: true, quantity: 2, reserved: 0, available: true },
  ],
  priceRange: null, available: true, primaryCategoryId: null, additionalCategoryIds: [], brandId: null, collectionIds: [], inventoryOptionIds: ["size"],
  options: [{ id: "size", name: "Size", type: "variant", required: true, values: [{ id: "double", label: "Double" }, { id: "king", label: "King" }] }],
  categoryMetadata: null, brandMetadata: null, collectionMetadata: [], ...overrides,
});
const store = (products: CatalogProduct[] = [], collections: CatalogCollection[] = []): StoreSnapshot => ({
  productsByHandle: new Map(products.map((item) => [item.handle, item])),
  skuOwners: new Map(products.flatMap((item) => item.variants.filter((variant) => variant.sku).map((variant) => [variant.sku!.toLowerCase(), { productId: item.id, handle: item.handle }] as const))),
  collections,
});

describe("planning an import", () => {
  it("creates a product with options from its rows, as a draft, with stock tracked", () => {
    const [plan] = planImport([
      line({ handle: "pine-bed", title: "Pine bed", vendor: "Linden", collections: "Bedroom", tags: "pine, bedroom", option1Name: "Size", option1Value: "Double", sku: "PINE-D", price: "£299.00", stock: "4" }),
      line({ handle: "pine-bed", option1Value: "King", sku: "PINE-K", price: "349", trackStock: "no" }),
    ], mapping, "upsert", store([], [collection("c1", "Bedroom")]));
    expect(plan.action).toBe("create");
    expect(plan.rows).toEqual([2, 3]);
    expect(plan.create).toMatchObject({ handle: "pine-bed", title: "Pine bed", status: "DRAFT", vendor: "Linden", tags: ["pine", "bedroom"], collectionIds: ["c1"], inventoryOptionIds: ["size"] });
    expect(plan.create!.options).toEqual([{ id: "size", name: "Size", type: "variant", required: true, position: 0, values: [{ id: "double", label: "Double", position: 0 }, { id: "king", label: "King", position: 1 }] }]);
    expect(plan.create!.variants).toEqual([
      expect.objectContaining({ title: "Double", sku: "PINE-D", priceMinor: 29900, options: { size: "double" }, trackInventory: true, quantity: 4 }),
      expect.objectContaining({ title: "King", sku: "PINE-K", priceMinor: 34900, options: { size: "king" }, trackInventory: false }),
    ]);
  });

  it("makes the handle from the title and treats a product without options as one item", () => {
    const [plan] = planImport([line({ title: "Linen Tote Bag", price: "24" })], mapping, "create", store());
    expect(plan).toMatchObject({ action: "create", handle: "linen-tote-bag" });
    expect(plan.create!.variants).toEqual([expect.objectContaining({ title: "Standard", options: {}, quantity: 0 })]);
    expect(plan.create!.inventoryOptionIds).toEqual([]);
  });

  it("follows the mode for products that exist and ones that do not", () => {
    const rows = [line({ handle: "oak-bed", sku: "OAK-D", price: "450" }), line({ handle: "new-bed", title: "New bed", price: "100" })];
    expect(planImport(rows, mapping, "create", store([product()])).map((plan) => plan.action)).toEqual(["skip", "create"]);
    expect(planImport(rows, mapping, "update", store([product()])).map((plan) => plan.action)).toEqual(["update", "skip"]);
    expect(planImport(rows, mapping, "upsert", store([product()])).map((plan) => plan.action)).toEqual(["update", "create"]);
  });

  it("updates only the columns in the file and finds variants by SKU or by option values", () => {
    const only: ColumnKey[] = ["handle", "option1Name", "option1Value", "sku", "price", "compareAtPrice", "stock"];
    const narrow = Object.fromEntries(only.map((key, index) => [key, index]));
    const cells = (values: Partial<Record<ColumnKey, string>>) => only.map((key) => values[key] ?? "");
    const [plan] = planImport([
      cells({ handle: "oak-bed", sku: "oak-d", price: "450.00", compareAtPrice: "", stock: "9" }),
      cells({ handle: "oak-bed", option1Name: "Size", option1Value: "king", price: "" }),
    ], narrow, "update", store([product()]));
    expect(plan.action).toBe("update");
    expect(plan.update!.productId).toBe("p1");
    // Title, brand, tags and status are not in the file, so they are not sent.
    expect(Object.keys(plan.update!.input)).toEqual(["variants"]);
    expect(plan.update!.input.variants).toEqual([
      { id: "v1", title: "Double", sku: "oak-d", priceMinor: 45000, compareAtPriceMinor: null, trackInventory: true, options: { size: "double" }, quantity: 9 },
      { id: "v2", title: "King", sku: null, priceMinor: 57900, compareAtPriceMinor: null, trackInventory: true, options: { size: "king" } },
    ]);
    expect(plan.columns).toEqual(expect.arrayContaining(["Price", "Compare-at price", "Stock", "SKU"]));
  });

  it("clears brand and tags from an empty cell but never the title or status", () => {
    const [plan] = planImport([line({ handle: "oak-bed", title: "", status: "", vendor: "", tags: "" })], mapping, "update", store([product()]));
    expect(plan.update!.input).toMatchObject({ vendor: null, tags: [] });
    expect(plan.update!.input.title).toBeUndefined();
    expect(plan.update!.input.status).toBeUndefined();
  });

  it("adds a new variant, with its new option value, to an existing product", () => {
    const [plan] = planImport([line({ handle: "oak-bed", option1Name: "size", option1Value: "Super king", sku: "OAK-SK", price: "699", stock: "1" })], mapping, "upsert", store([product()]));
    expect(plan.action).toBe("update");
    expect(plan.update!.input.variants).toEqual([expect.objectContaining({ title: "Super king", sku: "OAK-SK", priceMinor: 69900, options: { size: "super-king" }, quantity: 1 })]);
    expect((plan.update!.input.options as Array<{ values: unknown[] }>)[0].values).toHaveLength(3);
    expect(plan.columns).toContain("New variant");
  });

  it("explains each problem in plain words and holds back the whole product", () => {
    const plans = planImport([
      line({ handle: "Bad Handle", title: "Bad", price: "ten" }),
      line({ handle: "no-title", price: "5" }),
      line({ handle: "two-rows", title: "Two rows", option1Name: "Size", option1Value: "S", price: "5", sku: "DUP" }),
      line({ handle: "two-rows", option1Value: "S", price: "5", sku: "dup" }),
      line({ handle: "third", title: "Third", collections: "Nowhere", status: "live-ish", stock: "2.5", price: "5" }),
      line({ handle: "oak-bed", price: "500" }),
      line({ handle: "stolen", title: "Stolen", sku: "OAK-D", price: "5" }),
    ], mapping, "upsert", store([product()]));
    const messages = (handle: string) => plans.find((plan) => plan.handle === handle)!.reasons.map((reason) => `${reason.column ?? "-"}: ${reason.message}`);
    expect(plans.every((plan) => plan.action === "problem")).toBe(true);
    expect(messages("bad handle")).toEqual(expect.arrayContaining([expect.stringMatching(/^Price: is not a price/), expect.stringMatching(/^Handle: .*lowercase letters/)]));
    expect(messages("no-title")).toEqual([expect.stringMatching(/^Title: is empty/)]);
    expect(messages("two-rows")).toEqual(expect.arrayContaining([expect.stringMatching(/^SKU: "dup" is also on row 4/), expect.stringMatching(/Row 4 has the same Size/)]));
    expect(messages("third")).toEqual(expect.arrayContaining([expect.stringMatching(/^Collections: "Nowhere" is not a collection/), expect.stringMatching(/^Status: must be active, draft or archived/), expect.stringMatching(/^Stock: must be a whole number/)]));
    expect(messages("oak-bed")).toEqual([expect.stringMatching(/has Size in your store/)]);
    expect(messages("stolen")).toEqual([expect.stringMatching(/^SKU: "OAK-D" already belongs to another product/)]);
    expect(countPlans(plans)).toMatchObject({ products: 6, problem: 6, create: 0, rows: 7 });
  });

  it("flags a row that cannot be tied to any product", () => {
    const [plan] = planImport([line({ price: "5" })], mapping, "upsert", store());
    expect(plan).toMatchObject({ action: "problem", rows: [2] });
    expect(plan.reasons[0].message).toMatch(/no Handle, Title or SKU/);
  });
});

describe("export rows", () => {
  it("writes one row per variant with product details on the first, in template order", () => {
    const rows = productToRows(product({ collectionIds: ["c1"], seoTitle: "Oak bed | Harbour" }), new Map([["c1", collection("c1", "Bedroom")]]));
    const at = (row: string[], key: ColumnKey) => row[SHEET_COLUMNS.findIndex((column) => column.key === key)];
    expect(rows).toHaveLength(2);
    expect(at(rows[0], "title")).toBe("Oak bed");
    expect(at(rows[0], "collections")).toBe("Bedroom");
    expect(at(rows[0], "status")).toBe("active");
    expect(at(rows[0], "option1Name")).toBe("Size");
    expect(at(rows[0], "option1Value")).toBe("Double");
    expect(at(rows[0], "price")).toBe("499.00");
    expect(at(rows[0], "stock")).toBe("5");
    expect(at(rows[1], "handle")).toBe("oak-bed");
    expect(at(rows[1], "title")).toBe("");
    expect(at(rows[1], "option1Value")).toBe("King");
  });

  it("an exported product imports back as an update with nothing refused", () => {
    const existing = product({ collectionIds: ["c1"] });
    const collections = [collection("c1", "Bedroom")];
    const sheet = parseCsv(csv(toCsv([headerRow(), ...productToRows(existing, new Map([["c1", collections[0]]]))])));
    const [plan] = planImport(sheet.rows, suggestMapping(sheet.headers), "upsert", store([existing], collections));
    expect(plan.action).toBe("update");
    expect(plan.reasons).toEqual([]);
    expect(plan.update!.input.variants!.map((variant) => variant.id)).toEqual(["v1", "v2"]);
    expect(plan.update!.input.variants![0]).toMatchObject({ priceMinor: 49900, compareAtPriceMinor: 59900, quantity: 5, sku: "OAK-D" });
  });

  it("the template itself would import cleanly", () => {
    const table = templateTable();
    const plans = planImport(table.slice(1), suggestMapping(table[0]), "create", store());
    expect(plans.map((plan) => [plan.handle, plan.action, plan.rows.length])).toEqual([["linen-tote-bag", "create", 1], ["oak-bed-frame", "create", 2]]);
  });
});
