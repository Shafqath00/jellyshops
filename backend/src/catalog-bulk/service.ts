import { randomUUID } from "node:crypto";
import type { CatalogAdmin } from "../catalog/service.js";
import type { CatalogCollection, CatalogProduct, CatalogVariantInput, ListProductsInput, UpdateProductInput } from "../catalog/types.js";
import { ApiError } from "../http/errors.js";
import { countPlans, planImport, referencedKeys, type ImportMode, type PlanCounts, type PlanReason, type ProductPlan, type StoreSnapshot } from "./plan.js";
import { ImageFetchError, fetchImage } from "./image-fetch.js";
import {
  MAX_EXPORT_PRODUCTS, SHEET_COLUMNS, cleanMapping, headerRow, parseSheetFile, photoKeys, productToRows, storeMediaRef, suggestMapping, templateTable, toCsv, toXlsx,
  type ColumnMapping,
} from "./sheet.js";

/** The slice of the database the import record needs. Every query names the store. */
export interface BulkDatabase { query<T = Record<string, unknown>>(text: string, values?: unknown[]): Promise<{ rows: T[] }> }
type Catalog = Pick<CatalogAdmin, "listProducts" | "listCollections" | "findProducts" | "findSkuOwners" | "createProduct" | "updateProduct" | "getProduct">;

export const IMPORT_CHUNK = 20;
const PREVIEW_PLANS = 200;
const PREVIEW_PROBLEMS = 500;
const UPLOADS_PER_WINDOW = 10;
const UPLOAD_WINDOW_MS = 10 * 60 * 1000;
const UNDO_DAYS = 30;

export type ImportStatus = "uploaded" | "checked" | "running" | "finished" | "undone";
export interface ImportResult { rows: number[]; handle: string; title: string; outcome: "created" | "updated" | "skipped" | "failed"; productId?: string; reasons: PlanReason[] }
export interface ImportCounts { created: number; updated: number; skipped: number; failed: number; /** Products that were saved but had a photo that could not be added. */ photoProblems?: number }

/** How photos get stored. Left out where there is no file storage; photos in a file are then reported, not added. */
export interface ImageTools {
  upload(storeId: string, fileName: string, contents: Buffer): Promise<{ id: string }>;
  fetch?: (url: string) => Promise<{ buffer: Buffer; fileName: string }>;
}
export interface PhotoMatch { name: string; product: { id: string; title: string; handle: string; photoCount: number } | null; matchedBy: "sku" | "handle" | null }
const MAX_PRODUCT_PHOTOS = 30;
/** A step stops taking new products after this long, so slow photo downloads never run into the request limit. */
const STEP_BUDGET_MS = 25_000;
const PHOTOS_PER_WINDOW = 600;
interface UndoData {
  created: string[];
  updated: Array<{ productId: string; before: UpdateProductInput }>;
  added: Array<{ productId: string; variantIds: string[] }>;
}

export interface ImportView {
  id: string; fileName: string; format: "csv" | "xlsx"; status: ImportStatus; mode: ImportMode; rowCount: number;
  createdAt: string; finishedAt: string | null; undoneAt: string | null;
  progress: { done: number; total: number };
  counts: ImportCounts;
  summary: PlanCounts | null;
  canUndo: boolean;
}
export interface ImportDetail extends ImportView {
  headers: string[];
  mapping: ColumnMapping;
  sample: string[][];
  columns: Array<{ key: string; label: string; help: string; level: string; imported: boolean }>;
}
export interface PlanPreview { handle: string; title: string; action: ProductPlan["action"]; rows: number[]; variantCount: number; columns: string[]; reasons: PlanReason[] }
export interface CheckResult extends ImportDetail { plans: PlanPreview[]; problems: Array<PlanReason & { handle: string }>; morePlans: number; moreProblems: number }

interface Row {
  id: string; storeId: string; fileName: string; format: "csv" | "xlsx"; status: ImportStatus; mode: ImportMode; headers: string[]; rows: string[][]; rowCount: number;
  mapping: ColumnMapping; summary: PlanCounts | null; cursor: number; total: number; results: ImportResult[]; undo: UndoData; counts: ImportCounts;
  createdAt: Date | string; finishedAt: Date | string | null; undoneAt: Date | string | null;
}

const iso = (value: Date | string | null) => value == null ? null : new Date(value).toISOString();
const json = <T>(value: T | string): T => typeof value === "string" ? JSON.parse(value) as T : value;
const COLUMN_INFO = SHEET_COLUMNS.map(({ key, label, help, level, imported }) => ({ key, label, help, level, imported }));

export interface ExportFilter extends Omit<ListProductsInput, "limit" | "cursor"> { ids?: string[] }

/**
 * Product export, the import template, and product import (upload, check, run in steps, report, undo).
 * Saving goes through the same catalogue service the product builder uses, so every rule applies.
 */
export class ProductBulkService {
  private readonly uploads = new Map<string, number[]>();
  private readonly photoUploads = new Map<string, number[]>();

  constructor(private readonly database: BulkDatabase, private readonly catalog: Catalog, private readonly now: () => number = Date.now, private readonly images?: ImageTools) {}

  // ---- Export and template

  async exportTable(storeId: string, filter: ExportFilter): Promise<{ table: string[][]; products: number; truncated: boolean }> {
    const collections = new Map((await this.allCollections(storeId)).map((collection) => [collection.id, collection]));
    let products: CatalogProduct[] = [];
    let truncated = false;
    if (filter.ids) {
      products = await this.catalog.findProducts(storeId, { ids: filter.ids.slice(0, MAX_EXPORT_PRODUCTS) });
    } else {
      const { ids: _ids, ...query } = filter;
      let cursor: string | undefined;
      do {
        const page = await this.catalog.listProducts(storeId, { ...query, sort: query.sort ?? "title-asc", limit: 100, cursor });
        products.push(...page.nodes);
        cursor = page.nextCursor ?? undefined;
        if (products.length >= MAX_EXPORT_PRODUCTS && cursor) { truncated = true; cursor = undefined; }
      } while (cursor);
      products = products.slice(0, MAX_EXPORT_PRODUCTS);
    }
    return { table: [headerRow(), ...products.flatMap((product) => productToRows(product, collections))], products: products.length, truncated };
  }

  async file(table: string[][], format: "csv" | "xlsx", guide = false): Promise<{ body: Buffer; contentType: string; extension: string }> {
    return format === "xlsx"
      ? { body: await toXlsx(table, { sheetName: "Products", guide }), contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", extension: "xlsx" }
      : { body: Buffer.from(toCsv(table), "utf8"), contentType: "text/csv; charset=utf-8", extension: "csv" };
  }

  template(format: "csv" | "xlsx") { return this.file(templateTable(), format, true); }

  // ---- Import

  async upload(storeId: string, userId: string | undefined, fileName: string, buffer: Buffer): Promise<ImportDetail> {
    this.limitUploads(storeId, userId);
    const sheet = await parseSheetFile(fileName, buffer);
    await this.forgetOldRows(storeId);
    const id = `import-${randomUUID()}`;
    const mapping = suggestMapping(sheet.headers);
    await this.database.query(
      `INSERT INTO "ProductImport" ("id","storeId","createdBy","fileName","format","headers","rows","rowCount","mapping") VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9::jsonb)`,
      [id, storeId, userId ?? null, fileName.replace(/[\u0000-\u001f]/g, "").slice(0, 255) || "products", sheet.format, JSON.stringify(sheet.headers), JSON.stringify(sheet.rows), sheet.rows.length, JSON.stringify(mapping)],
    );
    return this.detail(await this.load(storeId, id));
  }

  /** Plans every row against the store. Nothing is saved to the catalogue. Can be repeated with another matching or mode. */
  async check(storeId: string, id: string, mappingInput: unknown, mode: ImportMode): Promise<CheckResult> {
    const record = await this.load(storeId, id);
    if (record.status !== "uploaded" && record.status !== "checked") throw new ApiError(409, "IMPORT_STARTED", "This import has already started, so its settings cannot change.");
    const mapping = cleanMapping(mappingInput, record.headers.length);
    for (const key of Object.keys(mapping)) if (!SHEET_COLUMNS.find((column) => column.key === key)?.imported) delete mapping[key as keyof ColumnMapping];
    if (mapping.handle === undefined && mapping.title === undefined && mapping.sku === undefined) throw new ApiError(422, "IMPORT_NO_KEY", "Match at least one of Handle, Title or SKU, so we can tell which product each row is.");
    const plans = planImport(record.rows, mapping, mode, await this.snapshot(storeId, record.rows, mapping));
    const summary = countPlans(plans);
    await this.database.query(`UPDATE "ProductImport" SET "mapping"=$3::jsonb, "mode"=$4, "summary"=$5::jsonb, "status"='checked', "total"=$6, "updatedAt"=NOW() WHERE "storeId"=$1 AND "id"=$2`, [storeId, id, JSON.stringify(mapping), mode, JSON.stringify(summary), plans.length]);
    const problems = plans.flatMap((plan) => plan.action === "problem" ? plan.reasons.map((reason) => ({ ...reason, handle: plan.handle })) : []);
    const detail = this.detail({ ...record, mapping, mode, summary, status: "checked", total: plans.length });
    return {
      ...detail,
      plans: plans.slice(0, PREVIEW_PLANS).map(({ handle, title, action, rows, variantCount, columns, reasons }) => ({ handle, title, action, rows, variantCount, columns, reasons })),
      problems: problems.slice(0, PREVIEW_PROBLEMS), morePlans: Math.max(0, plans.length - PREVIEW_PLANS), moreProblems: Math.max(0, problems.length - PREVIEW_PROBLEMS),
    };
  }

  /**
   * Saves the next few products and reports progress. The browser calls it until the import is finished.
   * Only one call works on an import at a time; a second one just reads the progress.
   */
  async run(storeId: string, id: string): Promise<ImportView> {
    const claimed = await this.database.query<{ id: string }>(
      `UPDATE "ProductImport" SET "lockedUntil"=NOW() + INTERVAL '90 seconds', "status"='running', "updatedAt"=NOW() WHERE "storeId"=$1 AND "id"=$2 AND "status" IN ('checked','running') AND ("lockedUntil" IS NULL OR "lockedUntil" < NOW()) RETURNING "id"`,
      [storeId, id]);
    const record = await this.load(storeId, id);
    if (!claimed.rows.length) {
      if (record.status === "uploaded") throw new ApiError(409, "IMPORT_NOT_CHECKED", "Check this file before importing it.");
      return this.view(record);
    }
    try {
      const other = await this.database.query(`SELECT 1 FROM "ProductImport" WHERE "storeId"=$1 AND "id"<>$2 AND "status"='running' AND "lockedUntil" > NOW() LIMIT 1`, [storeId, id]);
      if (other.rows.length) throw new ApiError(409, "IMPORT_BUSY", "Another import is running for this store. Wait for it to finish, then carry on with this one.");
      // Planned again against the store as it is now, so a product saved just before an interruption is found, not created twice.
      const plans = planImport(record.rows, record.mapping, record.mode, await this.snapshot(storeId, record.rows, record.mapping));
      const batch = plans.slice(record.cursor, record.cursor + IMPORT_CHUNK);
      const results: ImportResult[] = [];
      const undo: UndoData = { created: [], updated: [], added: [] };
      const counts: ImportCounts = { ...record.counts };
      const started = Date.now();
      let handled = 0;
      for (const plan of batch) {
        if (handled > 0 && Date.now() - started > STEP_BUDGET_MS) break;
        handled++;
        const base = { rows: plan.rows, handle: plan.handle, title: plan.title };
        if (plan.action === "skip") { results.push({ ...base, outcome: "skipped", reasons: plan.reasons }); counts.skipped++; continue; }
        if (plan.action === "problem") { results.push({ ...base, outcome: "failed", reasons: plan.reasons }); counts.failed++; continue; }
        try {
          if (plan.create) {
            const created = await this.catalog.createProduct(storeId, plan.create);
            undo.created.push(created.id);
            const notes = await this.addImages(storeId, created, plan.images, plan.rows[0]);
            if (notes.length) counts.photoProblems = (counts.photoProblems ?? 0) + 1;
            results.push({ ...base, outcome: "created", productId: created.id, reasons: notes }); counts.created++;
          } else if (plan.update) {
            const before = await this.catalog.getProduct(storeId, plan.update.productId);
            const after = await this.catalog.updateProduct(storeId, plan.update.productId, plan.update.input);
            if (before) {
              undo.updated.push({ productId: before.id, before: valuesBefore(before, plan.update.input) });
              const known = new Set(before.variants.map((variant) => variant.id));
              const added = after.variants.filter((variant) => !known.has(variant.id)).map((variant) => variant.id);
              if (added.length) undo.added.push({ productId: before.id, variantIds: added });
            }
            const notes = await this.addImages(storeId, after, plan.images, plan.rows[0]);
            if (notes.length) counts.photoProblems = (counts.photoProblems ?? 0) + 1;
            results.push({ ...base, outcome: "updated", productId: plan.update.productId, reasons: notes }); counts.updated++;
          }
        } catch (failure) {
          results.push({ ...base, outcome: "failed", reasons: [{ row: plan.rows[0], message: plainFailure(failure) }] }); counts.failed++;
        }
      }
      const cursor = record.cursor + handled;
      const finished = cursor >= plans.length;
      await this.database.query(
        `UPDATE "ProductImport" SET "cursor"=$3, "total"=$4, "results"="results" || $5::jsonb, "counts"=$6::jsonb,
           "undo"=jsonb_build_object('created', ("undo"->'created') || $7::jsonb, 'updated', ("undo"->'updated') || $8::jsonb, 'added', ("undo"->'added') || $9::jsonb),
           "status"=$10, "finishedAt"=CASE WHEN $11::boolean THEN NOW() ELSE NULL END, "lockedUntil"=NULL, "updatedAt"=NOW() WHERE "storeId"=$1 AND "id"=$2`,
        [storeId, id, cursor, plans.length, JSON.stringify(results), JSON.stringify(counts), JSON.stringify(undo.created), JSON.stringify(undo.updated), JSON.stringify(undo.added), finished ? "finished" : "running", finished]);
    } catch (failure) {
      await this.database.query(`UPDATE "ProductImport" SET "lockedUntil"=NULL WHERE "storeId"=$1 AND "id"=$2`, [storeId, id]);
      throw failure;
    }
    return this.view(await this.load(storeId, id));
  }

  /**
   * For the scheduled worker: takes one step of imports nobody is driving any more (the merchant closed the
   * page). An import whose page is still open is touched every few seconds and is left alone. This is the one
   * query that looks across stores; each import is then run inside its own store as usual.
   */
  async continueStalled(limit = 2): Promise<{ continued: number; finished: number }> {
    const stalled = await this.database.query<{ id: string; storeId: string }>(
      `SELECT "id","storeId" FROM "ProductImport" WHERE "status"='running' AND ("lockedUntil" IS NULL OR "lockedUntil" < NOW()) AND "updatedAt" < NOW() - INTERVAL '90 seconds' ORDER BY "updatedAt" LIMIT $1`, [Math.max(1, Math.min(5, limit))]);
    let continued = 0, finished = 0;
    for (const entry of stalled.rows) {
      try { const view = await this.run(String(entry.storeId), String(entry.id)); continued++; if (view.status === "finished") finished++; }
      catch { /* a busy store or a failing step is tried again on the next tick */ }
    }
    return { continued, finished };
  }

  async get(storeId: string, id: string): Promise<ImportDetail> { return this.detail(await this.load(storeId, id)); }

  async list(storeId: string): Promise<ImportView[]> {
    const result = await this.database.query<Row>(
      `SELECT "id","storeId","fileName","format","status","mode","rowCount","summary","cursor","total","counts","createdAt","finishedAt","undoneAt" FROM "ProductImport" WHERE "storeId"=$1 ORDER BY "createdAt" DESC LIMIT 20`, [storeId]);
    return result.rows.map((row) => this.view(normalise(row)));
  }

  /** Every product that was skipped or could not be imported, and every photo that could not be added, with the reason, as a table for a CSV file. */
  async report(storeId: string, id: string): Promise<string[][]> {
    const record = await this.load(storeId, id);
    const table = [["Row", "Handle", "Product", "Column", "What happened", "Reason"]];
    for (const result of record.results) {
      const saved = result.outcome === "created" || result.outcome === "updated";
      if (saved && !result.reasons.length) continue;
      for (const reason of result.reasons.length ? result.reasons : [{ row: result.rows[0], message: "No reason was recorded." }]) {
        table.push([String(reason.row), result.handle, result.title, reason.column ?? "", saved ? "Imported, but a photo was not added" : result.outcome === "failed" ? "Not imported" : "Skipped", reason.column ? `${reason.column} ${reason.message}` : reason.message]);
      }
    }
    return table;
  }

  /**
   * Reverses a finished import: products it created are archived, values it changed are put back, variants it
   * added are taken off sale. Stock is left as it is, because orders may have changed it since.
   */
  async undo(storeId: string, id: string): Promise<ImportView & { undone: { archived: number; restored: number; failed: number } }> {
    const record = await this.load(storeId, id);
    if (record.status !== "finished") throw new ApiError(409, "IMPORT_NOT_FINISHED", record.status === "undone" ? "This import has already been undone." : "Only a finished import can be undone.");
    if (!this.withinUndoWindow(record)) throw new ApiError(409, "IMPORT_TOO_OLD", `An import can be undone for ${UNDO_DAYS} days.`);
    const undone = { archived: 0, restored: 0, failed: 0 };
    for (const productId of record.undo.created) {
      try { await this.catalog.updateProduct(storeId, productId, { status: "ARCHIVED" }); undone.archived++; } catch { undone.failed++; }
    }
    // Newest change first, so a product updated twice ends with its oldest values.
    for (const entry of [...record.undo.updated].reverse()) {
      try { await this.catalog.updateProduct(storeId, entry.productId, entry.before); undone.restored++; } catch { undone.failed++; }
    }
    for (const entry of record.undo.added) {
      try {
        const current = await this.catalog.getProduct(storeId, entry.productId);
        const variants = (current?.variants ?? []).filter((variant) => entry.variantIds.includes(variant.id))
          .map((variant): CatalogVariantInput => ({ id: variant.id, title: variant.title, sku: variant.sku, priceMinor: variant.priceMinor, compareAtPriceMinor: variant.compareAtPriceMinor, trackInventory: variant.trackInventory, options: variant.options, sellable: false }));
        if (variants.length) await this.catalog.updateProduct(storeId, entry.productId, { variants });
      } catch { undone.failed++; }
    }
    await this.database.query(`UPDATE "ProductImport" SET "status"='undone', "undoneAt"=NOW(), "updatedAt"=NOW() WHERE "storeId"=$1 AND "id"=$2`, [storeId, id]);
    return { ...this.view(await this.load(storeId, id)), undone };
  }

  // ---- Photos

  /**
   * Adds the photos an import row lists to a saved product. A photo that cannot be fetched or is not an
   * image is reported and the rest carry on; the product itself stays imported. Nothing is ever removed.
   */
  private async addImages(storeId: string, product: CatalogProduct, images: string[] | undefined, row: number): Promise<PlanReason[]> {
    if (!images?.length) return [];
    const notes: PlanReason[] = [];
    const note = (entry: string, message: string) => { notes.push({ row, column: "Image URLs", message: `"${entry.length > 70 ? `${entry.slice(0, 70)}…` : entry}" ${message}.` }); };
    const have = new Set(product.media.map((media) => media.id));
    const add: string[] = [];
    for (const entry of images) {
      if (have.size + add.length >= MAX_PRODUCT_PHOTOS) { note(entry, `was left out: a product can have ${MAX_PRODUCT_PHOTOS} photos`); continue; }
      const stored = storeMediaRef(entry);
      if (stored) {
        // A photo that is already in this store's files (as written by an export) is linked, not downloaded again.
        if (stored.storeId !== storeId) note(entry, "belongs to another store");
        else if (!have.has(stored.mediaId) && !add.includes(stored.mediaId)) add.push(stored.mediaId);
        continue;
      }
      if (!this.images) { note(entry, "was not added: photos cannot be imported on this server"); continue; }
      try {
        const file = await (this.images.fetch ?? fetchImage)(entry);
        const media = await this.images.upload(storeId, file.fileName, file.buffer);
        if (!have.has(media.id) && !add.includes(media.id)) add.push(media.id);
      } catch (failure) {
        note(entry, failure instanceof ImageFetchError ? failure.message : failure instanceof ApiError && failure.status < 500 ? "is not a picture we can use. Use a JPEG, PNG, WebP, GIF or AVIF file" : "could not be added");
      }
    }
    if (add.length) {
      try {
        await this.catalog.updateProduct(storeId, product.id, { media: [...product.media.map((media) => ({ mediaId: media.id, altText: media.altText, appliesTo: media.appliesTo })), ...add.map((mediaId) => ({ mediaId }))] });
      } catch (failure) {
        notes.push({ row, column: "Image URLs", message: failure instanceof ApiError && failure.status < 500 ? failure.message : "The photos were downloaded but could not be linked to the product. Add them in the product editor." });
      }
    }
    return notes;
  }

  /** Which product each photo file belongs to, going by its name: an item's SKU first, then a product's handle. */
  async matchPhotos(storeId: string, names: string[]): Promise<PhotoMatch[]> {
    const wanted = names.slice(0, 300).map((name) => ({ name, keys: photoKeys(name) }));
    const keys = [...new Set(wanted.flatMap((item) => item.keys))];
    const owners = await this.catalog.findSkuOwners(storeId, keys);
    const products = await this.catalog.findProducts(storeId, { handles: keys, ids: owners.map((owner) => owner.productId) });
    const byHandle = new Map(products.map((product) => [product.handle.toLowerCase(), product]));
    const byId = new Map(products.map((product) => [product.id, product]));
    const bySku = new Map(owners.map((owner) => [owner.sku, byId.get(owner.productId)]));
    return wanted.map(({ name, keys: candidates }) => {
      for (const key of candidates) {
        const viaSku = bySku.get(key);
        const found = viaSku ?? byHandle.get(key);
        if (found) return { name, product: { id: found.id, title: found.title, handle: found.handle, photoCount: found.media.length }, matchedBy: viaSku ? "sku" as const : "handle" as const };
      }
      return { name, product: null, matchedBy: null };
    });
  }

  /** Stores one photo and adds it to the end of a product's photos. */
  async addPhoto(storeId: string, userId: string | undefined, productId: string, fileName: string, contents: Buffer): Promise<{ productId: string; photoCount: number; added: boolean }> {
    if (!this.images) throw new ApiError(503, "PHOTOS_UNAVAILABLE", "Photos cannot be uploaded on this server.");
    const key = `${storeId}:${userId ?? ""}`;
    const now = this.now();
    const recent = (this.photoUploads.get(key) ?? []).filter((time) => now - time < UPLOAD_WINDOW_MS);
    if (recent.length >= PHOTOS_PER_WINDOW) throw new ApiError(429, "PHOTOS_RATE_LIMITED", "You have uploaded a lot of photos in a short time. Wait a few minutes, then carry on.");
    recent.push(now);
    this.photoUploads.set(key, recent);
    const product = await this.catalog.getProduct(storeId, productId);
    if (!product) throw new ApiError(404, "PRODUCT_NOT_FOUND", "This product was not found.");
    if (product.media.length >= MAX_PRODUCT_PHOTOS) throw new ApiError(422, "MEDIA_LIMIT_EXCEEDED", `This product already has ${MAX_PRODUCT_PHOTOS} photos, which is the most a product can have.`);
    const media = await this.images.upload(storeId, fileName, contents);
    if (product.media.some((item) => item.id === media.id)) return { productId, photoCount: product.media.length, added: false };
    const after = await this.catalog.updateProduct(storeId, productId, { media: [...product.media.map((item) => ({ mediaId: item.id, altText: item.altText, appliesTo: item.appliesTo })), { mediaId: media.id }] });
    return { productId, photoCount: after.media.length, added: true };
  }

  // ---- Helpers

  private async snapshot(storeId: string, rows: string[][], mapping: ColumnMapping): Promise<StoreSnapshot> {
    const { handles, skus } = referencedKeys(rows, mapping);
    const owners = await this.catalog.findSkuOwners(storeId, skus);
    const products = await this.catalog.findProducts(storeId, { handles: [...new Set([...handles, ...owners.map((owner) => owner.handle)])] });
    return {
      productsByHandle: new Map(products.map((product) => [product.handle, product])),
      skuOwners: new Map(owners.map((owner) => [owner.sku, { productId: owner.productId, handle: owner.handle }])),
      collections: await this.allCollections(storeId),
    };
  }

  private async allCollections(storeId: string): Promise<CatalogCollection[]> {
    const collections: CatalogCollection[] = [];
    let cursor: string | undefined;
    do {
      const page = await this.catalog.listCollections(storeId, { limit: 100, cursor });
      collections.push(...page.nodes);
      cursor = page.nextCursor ?? undefined;
    } while (cursor && collections.length < 2000);
    return collections;
  }

  private async load(storeId: string, id: string): Promise<Row> {
    const result = await this.database.query<Row>(`SELECT * FROM "ProductImport" WHERE "storeId"=$1 AND "id"=$2`, [storeId, id]);
    if (!result.rows[0]) throw new ApiError(404, "IMPORT_NOT_FOUND", "This import was not found.");
    return normalise(result.rows[0]);
  }

  private withinUndoWindow(record: Pick<Row, "finishedAt">): boolean {
    return record.finishedAt != null && this.now() - new Date(record.finishedAt).getTime() < UNDO_DAYS * 24 * 60 * 60 * 1000;
  }

  private view(record: Row): ImportView {
    return {
      id: record.id, fileName: record.fileName, format: record.format, status: record.status, mode: record.mode, rowCount: record.rowCount,
      createdAt: iso(record.createdAt)!, finishedAt: iso(record.finishedAt), undoneAt: iso(record.undoneAt),
      progress: { done: record.cursor, total: record.total }, counts: record.counts, summary: record.summary,
      canUndo: record.status === "finished" && this.withinUndoWindow(record) && record.counts.created + record.counts.updated > 0,
    };
  }

  private detail(record: Row): ImportDetail {
    return { ...this.view(record), headers: record.headers, mapping: record.mapping, sample: (record.rows ?? []).slice(0, 5), columns: COLUMN_INFO };
  }

  /** The uploaded rows are only needed until an import is finished; older ones are emptied to save space. */
  private async forgetOldRows(storeId: string): Promise<void> {
    await this.database.query(`UPDATE "ProductImport" SET "rows"='[]'::jsonb WHERE "storeId"=$1 AND "rows" <> '[]'::jsonb AND (("status" IN ('finished','undone') AND "finishedAt" < NOW() - INTERVAL '30 days') OR ("status" IN ('uploaded','checked') AND "createdAt" < NOW() - INTERVAL '7 days'))`, [storeId]);
  }

  private limitUploads(storeId: string, userId: string | undefined): void {
    const key = `${storeId}:${userId ?? ""}`;
    const now = this.now();
    const recent = (this.uploads.get(key) ?? []).filter((time) => now - time < UPLOAD_WINDOW_MS);
    if (recent.length >= UPLOADS_PER_WINDOW) throw new ApiError(429, "IMPORT_RATE_LIMITED", "You have uploaded several files in a short time. Wait a few minutes and try again.");
    recent.push(now);
    this.uploads.set(key, recent);
  }
}

function normalise(row: Row): Row {
  return {
    ...row,
    headers: json(row.headers ?? []), rows: json(row.rows ?? []), mapping: json(row.mapping ?? {}), summary: row.summary == null ? null : json(row.summary),
    results: json(row.results ?? []), undo: json(row.undo ?? { created: [], updated: [], added: [] }), counts: json(row.counts ?? { created: 0, updated: 0, skipped: 0, failed: 0 }),
    cursor: Number(row.cursor ?? 0), total: Number(row.total ?? 0), rowCount: Number(row.rowCount ?? 0),
  };
}

/** The values an update is about to replace, so undo can put them back. Stock is deliberately left out. */
export function valuesBefore(product: CatalogProduct, input: UpdateProductInput): UpdateProductInput {
  const before: UpdateProductInput = {};
  if (input.title !== undefined) before.title = product.title;
  if (input.description !== undefined) { before.description = product.description; before.descriptionDoc = product.descriptionDoc ?? null; }
  if (input.status !== undefined) before.status = product.status;
  if (input.vendor !== undefined) before.vendor = product.vendor;
  if (input.productType !== undefined) before.productType = product.productType;
  if (input.tags !== undefined) before.tags = product.tags;
  if (input.collectionIds !== undefined) before.collectionIds = product.collectionIds;
  if (input.seoTitle !== undefined) before.seoTitle = product.seoTitle ?? null;
  if (input.seoDescription !== undefined) before.seoDescription = product.seoDescription ?? null;
  const touched = (input.variants ?? []).map((variant) => product.variants.find((existing) => existing.id === variant.id)).filter((variant): variant is CatalogProduct["variants"][number] => Boolean(variant));
  if (touched.length) before.variants = touched.map((variant) => ({
    id: variant.id, title: variant.title, sku: variant.sku, priceMinor: variant.priceMinor, compareAtPriceMinor: variant.compareAtPriceMinor,
    costMinor: variant.costMinor ?? null, barcode: variant.barcode ?? null, weightGrams: variant.weightGrams ?? null, trackInventory: variant.trackInventory, options: variant.options,
  }));
  return before;
}

/** A reason a merchant can act on; database and code errors are never shown. */
function plainFailure(failure: unknown): string {
  if (failure instanceof ApiError && failure.status < 500) return failure.message;
  const code = (failure as { code?: string })?.code;
  if (code === "23505") return "Another product in your store already uses this handle or SKU.";
  return "This product could not be saved. Try importing it again; if it keeps failing, add it in the product editor to see what is wrong.";
}
