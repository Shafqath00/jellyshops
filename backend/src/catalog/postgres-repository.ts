import type { QueryResultRow } from "pg";
import { randomUUID } from "node:crypto";
import type { SqlExecutor } from "../commerce/repository.js";
import type { CatalogCollection, CatalogProduct, CatalogVariant, Connection, ListCollectionsInput, ListProductsInput, CreateProductInput, UpdateProductInput, CreateCollectionInput, UpdateCollectionInput } from "./types.js";
import type { CatalogAdminRepository } from "./repository.js";

type Row = QueryResultRow & Record<string, unknown>;

/** SQL-backed catalog reader. Every query carries storeId to preserve tenant isolation. */
export class CatalogPostgresRepository implements CatalogAdminRepository {
  constructor(private readonly database: SqlExecutor) {}

  async listProducts(storeId: string, input: ListProductsInput): Promise<Connection<CatalogProduct>> {
    const values: unknown[] = [storeId];
    const filters = [`p."storeId" = $1`];
    if (input.status) filters.push(`p."status" = '${input.status}'`);
    if (input.query) { values.push(`%${input.query}%`); filters.push(`(p."title" ILIKE $${values.length} OR p."slug" ILIKE $${values.length})`); }
    if (input.cursor) { values.push(input.cursor); filters.push(`p."id" > $${values.length}`); }
    values.push(input.limit);
    const products = await this.database.query<Row>(`SELECT p.* FROM "Product" p WHERE ${filters.join(" AND ")} ORDER BY p."id" LIMIT $${values.length}`, values);
    if (!products.rows.length) return { nodes: [], nextCursor: null };
    const ids = products.rows.map((row) => String(row.id));
    const variants = await this.database.query<Row>(`SELECT v.*, i."quantity", i."reserved" FROM "ProductVariant" v LEFT JOIN "InventoryLevel" i ON i."storeId" = v."storeId" AND i."variantId" = v."id" WHERE v."storeId" = $1 AND v."productId" = ANY($2::text[]) AND v."archivedAt" IS NULL ORDER BY v."id"`, [storeId, ids]);
    const media = await this.database.query<Row>(`SELECT pm."productId", m.* FROM "ProductMedia" pm JOIN "Media" m ON m."storeId" = pm."storeId" AND m."id" = pm."mediaId" WHERE pm."storeId" = $1 AND pm."productId" = ANY($2::text[]) ORDER BY pm."position"`, [storeId, ids]);
    const nodes = products.rows.map((row) => this.product(row, variants.rows.filter((v) => String(v.productId) === String(row.id)), media.rows.filter((m) => String(m.productId) === String(row.id))));
    return { nodes, nextCursor: products.rows.length === input.limit ? String(products.rows.at(-1)!.id) : null };
  }

  async getProduct(storeId: string, id: string): Promise<CatalogProduct | null> { const result = await this.listProducts(storeId, { limit: 100, query: undefined }); return result.nodes.find((product) => product.id === id) ?? null; }
  async getVariant(storeId: string, id: string): Promise<CatalogVariant | null> {
    const result = await this.database.query<Row>(`SELECT v.*, i."quantity", i."reserved", p."status" FROM "ProductVariant" v JOIN "Product" p ON p."storeId" = v."storeId" AND p."id" = v."productId" LEFT JOIN "InventoryLevel" i ON i."storeId" = v."storeId" AND i."variantId" = v."id" WHERE v."storeId" = $1 AND v."id" = $2 AND v."archivedAt" IS NULL`, [storeId, id]);
    const row = result.rows[0]; if (!row || row.status !== "ACTIVE") return null; return this.variant(row);
  }
  async listCollections(storeId: string, _input: ListCollectionsInput): Promise<Connection<CatalogCollection>> { const result = await this.database.query<Row>(`SELECT c.* FROM "Collection" c WHERE c."storeId" = $1 ORDER BY c."id"`, [storeId]); return { nodes: result.rows.map((row) => ({ id: String(row.id), storeId, externalId: row.externalId ? String(row.externalId) : null, handle: String(row.slug), title: String(row.title), description: String(row.description ?? ""), productIds: [] })), nextCursor: null }; }
  async getCollection(storeId: string, id: string): Promise<CatalogCollection | null> { const result = await this.listCollections(storeId, { limit: 100 }); return result.nodes.find((collection) => collection.id === id) ?? null; }
  async createProduct(storeId: string, input: CreateProductInput): Promise<CatalogProduct> {
    const productId = `product-${randomUUID()}`;
    await this.database.query(
      `INSERT INTO "Product" ("id", "storeId", "title", "description", "status", "slug", "vendor", "productType", "tags", "primaryCategoryId", "additionalCategoryIds", "brandId", "collectionIds", "options", "inventoryOptionIds", "categoryMetadata", "brandMetadata", "collectionMetadata", "updatedAt")
       VALUES ($1, $2, $3, $4, $5::"ProductStatus", $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15, $16::jsonb, $17::jsonb, $18::jsonb, CURRENT_TIMESTAMP)`,
      [productId, storeId, input.title, input.description ?? "", input.status ?? "DRAFT", input.handle, input.vendor ?? null, input.productType ?? null, input.tags ?? [], input.primaryCategoryId ?? null, input.additionalCategoryIds ?? [], input.brandId ?? null, input.collectionIds ?? [], JSON.stringify(input.options ?? []), input.inventoryOptionIds ?? [], JSON.stringify(input.categoryMetadata ?? null), JSON.stringify(input.brandMetadata ?? null), JSON.stringify(input.collectionMetadata ?? [])],
    );
    for (const variant of input.variants ?? []) {
      await this.insertVariant(storeId, productId, variant);
    }
    const product = await this.getProduct(storeId, productId);
    if (!product) throw new Error("Created product could not be loaded");
    return product;
  }

  async updateProduct(storeId: string, id: string, input: UpdateProductInput): Promise<CatalogProduct> {
    const current = await this.getProduct(storeId, id);
    if (!current) throw new Error("Product not found");
    const fields: string[] = [];
    const values: unknown[] = [];
    const set = (field: string, value: unknown) => { values.push(value); fields.push(`"${field}" = $${values.length}`); };
    if (input.title !== undefined) set("title", input.title);
    if (input.description !== undefined) set("description", input.description);
    if (input.handle !== undefined) set("slug", input.handle);
    if (input.vendor !== undefined) set("vendor", input.vendor);
    if (input.productType !== undefined) set("productType", input.productType);
    if (input.tags !== undefined) set("tags", input.tags);
    if (input.status !== undefined) { values.push(input.status); fields.push(`"status" = $${values.length}::"ProductStatus"`); }
    if (input.primaryCategoryId !== undefined) set("primaryCategoryId", input.primaryCategoryId);
    if (input.additionalCategoryIds !== undefined) set("additionalCategoryIds", input.additionalCategoryIds);
    if (input.brandId !== undefined) set("brandId", input.brandId);
    if (input.collectionIds !== undefined) set("collectionIds", input.collectionIds);
    if (input.options !== undefined) { values.push(JSON.stringify(input.options)); fields.push(`"options" = $${values.length}::jsonb`); }
    if (input.inventoryOptionIds !== undefined) set("inventoryOptionIds", input.inventoryOptionIds);
    if (input.categoryMetadata !== undefined) { values.push(JSON.stringify(input.categoryMetadata)); fields.push(`"categoryMetadata" = $${values.length}::jsonb`); }
    if (input.brandMetadata !== undefined) { values.push(JSON.stringify(input.brandMetadata)); fields.push(`"brandMetadata" = $${values.length}::jsonb`); }
    if (input.collectionMetadata !== undefined) { values.push(JSON.stringify(input.collectionMetadata)); fields.push(`"collectionMetadata" = $${values.length}::jsonb`); }
    if (fields.length) {
      values.push(storeId, id);
      await this.database.query(`UPDATE "Product" SET ${fields.join(", ")}, "updatedAt" = CURRENT_TIMESTAMP WHERE "storeId" = $${values.length - 1} AND "id" = $${values.length}`, values);
    }
    for (const variant of input.variants ?? []) {
      if (variant.id) {
        await this.database.query(
          `UPDATE "ProductVariant" SET "title" = $3, "sku" = $4, "priceMinor" = $5, "trackInventory" = $6, "updatedAt" = CURRENT_TIMESTAMP WHERE "storeId" = $1 AND "productId" = $2 AND "id" = $7`,
          [storeId, id, variant.title, variant.sku ?? null, variant.priceMinor, variant.trackInventory ?? true, variant.id],
        );
        if (variant.quantity != null) await this.upsertInventory(storeId, variant.id, variant.quantity);
      } else {
        await this.insertVariant(storeId, id, variant);
      }
    }
    const product = await this.getProduct(storeId, id);
    if (!product) throw new Error("Updated product could not be loaded");
    return product;
  }
  async createCollection(_storeId: string, _input: CreateCollectionInput): Promise<CatalogCollection> { throw new Error("Catalog writes require the catalog admin adapter"); }
  async updateCollection(_storeId: string, _id: string, _input: UpdateCollectionInput): Promise<CatalogCollection> { throw new Error("Catalog writes require the catalog admin adapter"); }

  private async insertVariant(storeId: string, productId: string, input: NonNullable<CreateProductInput["variants"]>[number]): Promise<void> {
    const variantId = input.id ?? `variant-${randomUUID()}`;
    await this.database.query(
      `INSERT INTO "ProductVariant" ("id", "storeId", "productId", "title", "sku", "priceMinor", "options", "trackInventory", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, CURRENT_TIMESTAMP)`,
      [variantId, storeId, productId, input.title, input.sku ?? null, input.priceMinor, JSON.stringify(input.options ?? {}), input.trackInventory ?? true],
    );
    if (input.quantity != null) await this.upsertInventory(storeId, variantId, input.quantity);
  }

  private async upsertInventory(storeId: string, variantId: string, quantity: number): Promise<void> {
    await this.database.query(
      `INSERT INTO "InventoryLevel" ("storeId", "variantId", "quantity", "reserved", "updatedAt") VALUES ($1, $2, $3, 0, CURRENT_TIMESTAMP)
       ON CONFLICT ("storeId", "variantId") DO UPDATE SET "quantity" = $3, "updatedAt" = CURRENT_TIMESTAMP`,
      [storeId, variantId, quantity],
    );
  }

  private variant(row: Row): CatalogVariant { const quantity = row.quantity == null ? null : Number(row.quantity); const reserved = row.reserved == null ? null : Number(row.reserved); return { id: String(row.id), productId: String(row.productId), externalId: row.externalId ? String(row.externalId) : null, title: String(row.title), sku: row.sku ? String(row.sku) : null, priceMinor: Number(row.priceMinor), compareAtPriceMinor: row.compareAtPriceMinor == null ? null : Number(row.compareAtPriceMinor), options: (row.options ?? {}) as Record<string, unknown>, trackInventory: Boolean(row.trackInventory), quantity, reserved, available: !Boolean(row.trackInventory) || (quantity !== null && reserved !== null && quantity - reserved > 0) }; }
  private product(row: Row, variantRows: Row[], mediaRows: Row[]): CatalogProduct { const variants = variantRows.map((variant) => this.variant(variant)); const prices = variants.map((variant) => variant.priceMinor); return { id: String(row.id), storeId: String(row.storeId), externalId: row.externalId ? String(row.externalId) : null, handle: String(row.slug), title: String(row.title), description: String(row.description ?? ""), vendor: row.vendor ? String(row.vendor) : null, productType: row.productType ? String(row.productType) : null, tags: Array.isArray(row.tags) ? row.tags.map(String) : [], status: String(row.status) as CatalogProduct["status"], media: mediaRows.map((media) => ({ id: String(media.id), url: String(media.url), mimeType: String(media.mimeType), width: media.width == null ? null : Number(media.width), height: media.height == null ? null : Number(media.height), altText: media.altText ? String(media.altText) : null, position: Number(media.position ?? 0) })), variants, priceRange: prices.length ? { minMinor: Math.min(...prices), maxMinor: Math.max(...prices), currency: "USD" } : null, available: variants.some((variant) => variant.available), primaryCategoryId: row.primaryCategoryId ? String(row.primaryCategoryId) : null, additionalCategoryIds: Array.isArray(row.additionalCategoryIds) ? row.additionalCategoryIds.map(String) : [], brandId: row.brandId ? String(row.brandId) : null, collectionIds: Array.isArray(row.collectionIds) ? row.collectionIds.map(String) : [], options: Array.isArray(row.options) ? row.options : [], inventoryOptionIds: Array.isArray(row.inventoryOptionIds) ? row.inventoryOptionIds.map(String) : [], categoryMetadata: row.categoryMetadata ?? null, brandMetadata: row.brandMetadata ?? null, collectionMetadata: Array.isArray(row.collectionMetadata) ? row.collectionMetadata : [] }; }
}
