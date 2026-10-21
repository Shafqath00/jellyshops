import type { QueryResultRow } from "pg";
import { randomUUID } from "node:crypto";
import type { CommerceDatabase, SqlExecutor } from "../commerce/repository.js";
import { ApiError } from "../http/errors.js";
import type { CatalogCollection, CatalogCollectionDetail, CatalogProduct, CatalogVariant, Connection, ListCollectionsInput, ListProductsInput, CreateProductInput, UpdateProductInput, CreateCollectionInput, UpdateCollectionInput } from "./types.js";
import type { CatalogAdminRepository } from "./repository.js";

type Row = QueryResultRow & Record<string, unknown>;

/** SQL-backed catalog reader. Every query carries storeId to preserve tenant isolation. */
export class CatalogPostgresRepository implements CatalogAdminRepository {
  constructor(private readonly database: SqlExecutor, private readonly transactions?: CommerceDatabase) {}

  async listProducts(storeId: string, input: ListProductsInput): Promise<Connection<CatalogProduct>> {
    const values: unknown[] = [storeId];
    const filters = [`p."storeId" = $1`];
    const bind = (value: unknown) => { values.push(value); return `$${values.length}`; };
    if (input.status) filters.push(`p."status" = ${bind(input.status)}::"ProductStatus"`);
    if (input.query) { values.push(`%${input.query}%`); filters.push(`(p."title" ILIKE $${values.length} OR p."slug" ILIKE $${values.length})`); }
    if (input.collectionId) filters.push(`p."collectionIds" @> ARRAY[${bind(input.collectionId)}]::text[]`);
    if (input.categoryId) { const category = bind(input.categoryId); filters.push(`(p."primaryCategoryId"=${category} OR p."additionalCategoryIds" @> ARRAY[${category}]::text[])`); }
    const variants = ['v."storeId"=p."storeId"', 'v."productId"=p."id"', 'v."archivedAt" IS NULL'];
    if (input.minPriceMinor !== undefined) variants.push(`v."priceMinor">=${bind(input.minPriceMinor)}`);
    if (input.maxPriceMinor !== undefined) variants.push(`v."priceMinor"<=${bind(input.maxPriceMinor)}`);
    if (input.variantOptions) variants.push(`v."options" @> ${bind(JSON.stringify(input.variantOptions))}::jsonb`);
    if (variants.length > 3) filters.push(`EXISTS (SELECT 1 FROM "ProductVariant" v WHERE ${variants.join(" AND ")})`);
    if (input.available !== undefined) filters.push(`${input.available ? "" : "NOT "}EXISTS (SELECT 1 FROM "ProductVariant" v LEFT JOIN "InventoryLevel" i ON i."storeId"=v."storeId" AND i."variantId"=v."id" WHERE v."storeId"=p."storeId" AND v."productId"=p."id" AND v."archivedAt" IS NULL AND (NOT v."trackInventory" OR i."quantity">i."reserved"))`);
    const sort = input.sort ?? "id";
    const price = `COALESCE((SELECT MIN(v."priceMinor") FROM "ProductVariant" v WHERE v."storeId"=p."storeId" AND v."productId"=p."id" AND v."archivedAt" IS NULL),0)`;
    const metric = sort === "newest" ? 'EXTRACT(EPOCH FROM p."createdAt") * 1000' : sort.startsWith("price-") ? price : sort === "title-asc" ? 'p."title"' : sort === "best-selling" ? `COALESCE((SELECT SUM(oi."quantity") FROM "OrderItem" oi JOIN "ProductVariant" v ON v."storeId"=oi."storeId" AND v."id"=oi."variantId" JOIN "Order" o ON o."storeId"=oi."storeId" AND o."id"=oi."orderId" JOIN "Payment" pay ON pay."storeId"=o."storeId" AND pay."orderId"=o."id" WHERE oi."storeId"=p."storeId" AND v."productId"=p."id" AND pay."status"='PAID' AND o."status" NOT IN ('CANCELLED','REFUNDED')),0)` : 'p."id"';
    const descending = ["newest", "price-desc", "best-selling"].includes(sort);
    if (sort === "best-selling") filters.push(`(${metric}) > 0`);
    if (input.cursor) {
      if (sort === "id") filters.push(`p."id">${bind(input.cursor)}`);
      else {
        let cursor: { sort: string; value: string | number; id: string };
        try { cursor = JSON.parse(Buffer.from(input.cursor, "base64url").toString()); if (cursor.sort !== sort || typeof cursor.id !== "string" || !["string", "number"].includes(typeof cursor.value)) throw new Error(); }
        catch { throw new ApiError(422, "CATALOG_CURSOR_INVALID", "Restart the list after changing its sort order."); }
        const value = bind(cursor.value); const id = bind(cursor.id);
        filters.push(`((${metric}) ${descending ? "<" : ">"} ${value} OR ((${metric})=${value} AND p."id">${id}))`);
      }
    }
    const limit = Math.max(1, Math.min(100, input.limit));
    const products = await this.database.query<Row>(`SELECT p.*, s."currency" AS "storeCurrency", (${metric}) AS "sortValue" FROM "Product" p JOIN "Store" s ON s."id"=p."storeId" WHERE ${filters.join(" AND ")} ORDER BY (${metric}) ${descending ? "DESC" : "ASC"},p."id" ASC LIMIT ${bind(limit + 1)}`, values);
    const page = products.rows.slice(0, limit); const last = page.at(-1);
    const nextCursor = products.rows.length > limit && last ? sort === "id" ? String(last.id) : Buffer.from(JSON.stringify({ sort, value: last.sortValue, id: last.id })).toString("base64url") : null;
    return { nodes: await this.hydrateProducts(storeId, page), nextCursor };
  }

  private async hydrateProducts(storeId: string, productRows: Row[]): Promise<CatalogProduct[]> {
    if (!productRows.length) return [];
    const ids = productRows.map((row) => String(row.id));
    const variants = await this.database.query<Row>(`SELECT v.*, i."quantity", i."reserved" FROM "ProductVariant" v LEFT JOIN "InventoryLevel" i ON i."storeId" = v."storeId" AND i."variantId" = v."id" WHERE v."storeId" = $1 AND v."productId" = ANY($2::text[]) AND v."archivedAt" IS NULL ORDER BY v."id"`, [storeId, ids]);
    const media = await this.database.query<Row>(`SELECT pm."productId", m.* FROM "ProductMedia" pm JOIN "Media" m ON m."storeId" = pm."storeId" AND m."id" = pm."mediaId" WHERE pm."storeId" = $1 AND pm."productId" = ANY($2::text[]) ORDER BY pm."position"`, [storeId, ids]);
    return productRows.map((row) => this.product(row, variants.rows.filter((v) => String(v.productId) === String(row.id)), media.rows.filter((m) => String(m.productId) === String(row.id))));
  }

  async getProduct(storeId: string, id: string): Promise<CatalogProduct | null> {
    const result = await this.database.query<Row>(`SELECT p.*, s."currency" AS "storeCurrency" FROM "Product" p JOIN "Store" s ON s."id" = p."storeId" WHERE p."storeId" = $1 AND p."id" = $2`, [storeId, id]);
    return (await this.hydrateProducts(storeId, result.rows))[0] ?? null;
  }
  async getVariant(storeId: string, id: string): Promise<CatalogVariant | null> {
    const result = await this.database.query<Row>(`SELECT v.*, i."quantity", i."reserved", p."status", to_jsonb(p)->>'fulfillmentType' AS "fulfillmentType" FROM "ProductVariant" v JOIN "Product" p ON p."storeId" = v."storeId" AND p."id" = v."productId" LEFT JOIN "InventoryLevel" i ON i."storeId" = v."storeId" AND i."variantId" = v."id" WHERE v."storeId" = $1 AND v."id" = $2 AND v."archivedAt" IS NULL`, [storeId, id]);
    const row = result.rows[0]; if (!row || row.status !== "ACTIVE") return null; return this.variant(row);
  }
  async listCollections(storeId: string, input: ListCollectionsInput): Promise<Connection<CatalogCollection>> {
    const values: unknown[] = [storeId];
    const filters = ['c."storeId" = $1'];
    if (input.query) { values.push(`%${input.query}%`); filters.push(`(c."title" ILIKE $${values.length} OR c."slug" ILIKE $${values.length})`); }
    if (input.cursor) { values.push(input.cursor); filters.push(`c."id" > $${values.length}`); }
    const limit = Math.max(1, Math.min(100, input.limit));
    values.push(limit + 1);
    const result = await this.database.query<Row>(`SELECT c.*, COALESCE((SELECT array_agg(p."id" ORDER BY p."id") FROM "Product" p WHERE p."storeId"=c."storeId" AND p."collectionIds" @> ARRAY[c."id"]::text[]), ARRAY[]::text[]) AS "productIds" FROM "Collection" c WHERE ${filters.join(" AND ")} ORDER BY c."id" LIMIT $${values.length}`, values);
    const rows = result.rows.slice(0, limit);
    const last = rows.at(-1);
    return { nodes: rows.map((row) => ({ id: String(row.id), storeId, externalId: row.externalId ? String(row.externalId) : null, handle: String(row.slug), title: String(row.title), description: String(row.description ?? ""), productIds: Array.isArray(row.productIds) ? row.productIds.map(String) : [] })), nextCursor: result.rows.length > limit && last ? String(last.id) : null };
  }
  async getCollection(storeId: string, id: string): Promise<CatalogCollectionDetail | null> {
    const collection = await this.database.query<Row>(`SELECT c.* FROM "Collection" c WHERE c."storeId" = $1 AND c."id" = $2`, [storeId, id]);
    const row = collection.rows[0];
    if (!row) return null;
    const productRows = await this.database.query<Row>(`SELECT p.*, s."currency" AS "storeCurrency" FROM "Product" p JOIN "Store" s ON s."id" = p."storeId" WHERE p."storeId" = $1 AND p."collectionIds" @> ARRAY[$2]::text[] ORDER BY p."id"`, [storeId, id]);
    const products = await this.hydrateProducts(storeId, productRows.rows);
    return { id: String(row.id), storeId, externalId: row.externalId ? String(row.externalId) : null, handle: String(row.slug), title: String(row.title), description: String(row.description ?? ""), productIds: products.map((product) => product.id), products };
  }
  async createProduct(storeId: string, input: CreateProductInput): Promise<CatalogProduct> {
    if (this.transactions) return this.transactions.transaction((sql) => new CatalogPostgresRepository(sql).createProduct(storeId, input));
    const productId = `product-${randomUUID()}`;
    await this.database.query(
      `INSERT INTO "Product" ("id", "storeId", "title", "description", "specifications", "status", "slug", "vendor", "productType", "tags", "primaryCategoryId", "additionalCategoryIds", "brandId", "collectionIds", "options", "inventoryOptionIds", "categoryMetadata", "brandMetadata", "collectionMetadata", "updatedAt")
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::"ProductStatus", $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb, $16, $17::jsonb, $18::jsonb, $19::jsonb, CURRENT_TIMESTAMP)`,
      [productId, storeId, input.title, input.description ?? "", JSON.stringify(input.specifications ?? {}), input.status ?? "DRAFT", input.handle, input.vendor ?? null, input.productType ?? null, input.tags ?? [], input.primaryCategoryId ?? null, input.additionalCategoryIds ?? [], input.brandId ?? null, input.collectionIds ?? [], JSON.stringify(input.options ?? []), input.inventoryOptionIds ?? [], JSON.stringify(input.categoryMetadata ?? null), JSON.stringify(input.brandMetadata ?? null), JSON.stringify(input.collectionMetadata ?? [])],
    );
    for (const variant of input.variants ?? []) {
      await this.insertVariant(storeId, productId, variant);
    }
    if (input.imageUrl) await this.setProductImage(storeId, productId, input.imageUrl);
    const product = await this.getProduct(storeId, productId);
    if (!product) throw new Error("Created product could not be loaded");
    return product;
  }

  async updateProduct(storeId: string, id: string, input: UpdateProductInput): Promise<CatalogProduct> {
    if (this.transactions) return this.transactions.transaction((sql) => new CatalogPostgresRepository(sql).updateProduct(storeId, id, input));
    const current = await this.getProduct(storeId, id);
    if (!current) throw new ApiError(404, "PRODUCT_NOT_FOUND", "Product not found");
    const fields: string[] = [];
    const values: unknown[] = [];
    const set = (field: string, value: unknown) => { values.push(value); fields.push(`"${field}" = $${values.length}`); };
    if (input.title !== undefined) set("title", input.title);
    if (input.description !== undefined) set("description", input.description);
    if (input.specifications !== undefined) { values.push(JSON.stringify(input.specifications)); fields.push(`"specifications" = $${values.length}::jsonb`); }
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
        const updatedVariant = await this.database.query(
        `UPDATE "ProductVariant" SET "title" = $3, "sku" = $4, "priceMinor" = $5, "compareAtPriceMinor" = $6, "trackInventory" = $7, "options" = $9::jsonb, "updatedAt" = CURRENT_TIMESTAMP WHERE "storeId" = $1 AND "productId" = $2 AND "id" = $8 RETURNING "id"`,
          [storeId, id, variant.title, variant.sku ?? null, variant.priceMinor, variant.compareAtPriceMinor ?? null, variant.trackInventory ?? true, variant.id, JSON.stringify(variant.options ?? {})],
        );
        if (!updatedVariant.rows.length) throw new ApiError(422, "VARIANT_INVALID", "The variant does not belong to this product.");
        if (variant.quantity != null) await this.upsertInventory(storeId, variant.id, variant.quantity);
      } else {
        await this.insertVariant(storeId, id, variant);
      }
    }
    if (input.imageUrl) await this.setProductImage(storeId, id, input.imageUrl);
    const product = await this.getProduct(storeId, id);
    if (!product) throw new Error("Updated product could not be loaded");
    return product;
  }
  async createCollection(storeId: string, input: CreateCollectionInput): Promise<CatalogCollection> {
    if (this.transactions) return this.transactions.transaction((sql) => new CatalogPostgresRepository(sql).createCollection(storeId, input));
    const id = 'collection-' + randomUUID();
    await this.validateCollectionProducts(storeId, input.productIds ?? []);
    await this.database.query('INSERT INTO "Collection" ("id","storeId","title","slug","description","updatedAt") VALUES ($1,$2,$3,$4,$5,CURRENT_TIMESTAMP)', [id, storeId, input.title, input.handle, input.description ?? '']);
    if (input.productIds?.length) await this.database.query('UPDATE "Product" SET "collectionIds" = array_append("collectionIds", $2), "updatedAt" = CURRENT_TIMESTAMP WHERE "storeId" = $1 AND "id" = ANY($3::text[])', [storeId, id, input.productIds]);
    return (await this.getCollection(storeId, id))!;
  }
  async updateCollection(storeId: string, id: string, input: UpdateCollectionInput): Promise<CatalogCollection> {
    if (this.transactions) return this.transactions.transaction((sql) => new CatalogPostgresRepository(sql).updateCollection(storeId, id, input));
    if (!await this.getCollection(storeId, id)) throw new ApiError(404, 'COLLECTION_NOT_FOUND', 'Collection not found');
    if (input.productIds) await this.validateCollectionProducts(storeId, input.productIds);
    await this.database.query('UPDATE "Collection" SET "title" = COALESCE($3,"title"), "slug" = COALESCE($4,"slug"), "description" = COALESCE($5,"description"), "updatedAt" = CURRENT_TIMESTAMP WHERE "storeId" = $1 AND "id" = $2', [storeId, id, input.title ?? null, input.handle ?? null, input.description ?? null]);
    if (input.productIds) {
      await this.database.query('UPDATE "Product" SET "collectionIds" = array_remove("collectionIds", $2), "updatedAt" = CURRENT_TIMESTAMP WHERE "storeId" = $1 AND "collectionIds" @> ARRAY[$2]::text[]', [storeId, id]);
      await this.database.query('UPDATE "Product" SET "collectionIds" = array_append("collectionIds", $2), "updatedAt" = CURRENT_TIMESTAMP WHERE "storeId" = $1 AND "id" = ANY($3::text[])', [storeId, id, input.productIds]);
    }
    return (await this.getCollection(storeId, id))!;
  }
  private async validateCollectionProducts(storeId: string, ids: string[]): Promise<void> {
    const result = await this.database.query('SELECT "id" FROM "Product" WHERE "storeId" = $1 AND "id" = ANY($2::text[])', [storeId, ids]);
    if (result.rows.length !== new Set(ids).size) throw new ApiError(422, 'COLLECTION_PRODUCTS_INVALID', 'A selected product is not available in this store.');
  }

  private async insertVariant(storeId: string, productId: string, input: NonNullable<CreateProductInput["variants"]>[number]): Promise<void> {
    const variantId = `variant-${randomUUID()}`;
    await this.database.query(
      `INSERT INTO "ProductVariant" ("id", "storeId", "productId", "title", "sku", "priceMinor", "compareAtPriceMinor", "options", "trackInventory", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, CURRENT_TIMESTAMP)`,
      [variantId, storeId, productId, input.title, input.sku ?? null, input.priceMinor, input.compareAtPriceMinor ?? null, JSON.stringify(input.options ?? {}), input.trackInventory ?? true],
    );
    if (input.quantity != null) await this.upsertInventory(storeId, variantId, input.quantity);
  }

  private async setProductImage(storeId: string, productId: string, url: string): Promise<void> {
    const parsed = new URL(url);
    if (!["https:", "http:"].includes(parsed.protocol)) throw new ApiError(422, "MEDIA_INVALID", "Use an HTTP or HTTPS image URL.");
    const publicPath = parsed.pathname.match(/\/api\/public\/media\/([^/]+)\/([^/]+)$/);
    let mediaId: string;
    if (publicPath) {
      if (decodeURIComponent(publicPath[1]) !== storeId) throw new ApiError(422, "MEDIA_INVALID", "The image belongs to another store.");
      mediaId = decodeURIComponent(publicPath[2]);
      if (!(await this.database.query(`SELECT "id" FROM "Media" WHERE "storeId" = $1 AND "id" = $2`, [storeId, mediaId])).rows.length) throw new ApiError(422, "MEDIA_INVALID", "The uploaded image could not be found.");
    } else {
      const existing = await this.database.query<{ id: string }>(`SELECT "id" FROM "Media" WHERE "storeId" = $1 AND "url" = $2 LIMIT 1`, [storeId, url]);
      mediaId = existing.rows[0]?.id ?? randomUUID();
      if (!existing.rows.length) await this.database.query(`INSERT INTO "Media" ("id", "storeId", "type", "storageKey", "url", "mimeType", "byteSize", "originalName") VALUES ($1,$2,'image',$3,$4,'image/jpeg',0,'External image')`, [mediaId, storeId, `external/${mediaId}`, url]);
    }
    await this.database.query(`DELETE FROM "ProductMedia" WHERE "storeId" = $1 AND "productId" = $2`, [storeId, productId]);
    await this.database.query(`INSERT INTO "ProductMedia" ("storeId", "productId", "mediaId", "position") VALUES ($1,$2,$3,0)`, [storeId, productId, mediaId]);
  }

  private async upsertInventory(storeId: string, variantId: string, quantity: number): Promise<void> {
    const updated = await this.database.query(
      `INSERT INTO "InventoryLevel" ("storeId", "variantId", "quantity", "reserved", "updatedAt") VALUES ($1, $2, $3, 0, CURRENT_TIMESTAMP)
       ON CONFLICT ("storeId", "variantId") DO UPDATE SET "quantity" = $3, "updatedAt" = CURRENT_TIMESTAMP WHERE "InventoryLevel"."reserved" <= $3 RETURNING "variantId"`,
      [storeId, variantId, quantity],
    );
    if (!updated.rows.length) throw new ApiError(409, "INVENTORY_RESERVED", "Stock cannot be lower than the quantity reserved by active checkouts.");
  }

  private variant(row: Row): CatalogVariant { const quantity = row.quantity == null ? null : Number(row.quantity); const reserved = row.reserved == null ? null : Number(row.reserved); return { id: String(row.id), productId: String(row.productId), externalId: row.externalId ? String(row.externalId) : null, title: String(row.title), sku: row.sku ? String(row.sku) : null, priceMinor: Number(row.priceMinor), compareAtPriceMinor: row.compareAtPriceMinor == null ? null : Number(row.compareAtPriceMinor), options: (row.options ?? {}) as Record<string, unknown>, trackInventory: Boolean(row.trackInventory), quantity, reserved, available: row.fulfillmentType === "DIGITAL" || !Boolean(row.trackInventory) || (quantity !== null && reserved !== null && quantity - reserved > 0) }; }
  private product(row: Row, variantRows: Row[], mediaRows: Row[]): CatalogProduct { const variants = variantRows.map((variant) => this.variant({ ...variant, fulfillmentType: row.fulfillmentType })); const prices = variants.map((variant) => variant.priceMinor); return { fulfillmentType: row.fulfillmentType === "DIGITAL" ? "DIGITAL" : "PHYSICAL", id: String(row.id), storeId: String(row.storeId), externalId: row.externalId ? String(row.externalId) : null, handle: String(row.slug), title: String(row.title), description: String(row.description ?? ""), specifications: (row.specifications ?? {}) as Record<string, string>, vendor: row.vendor ? String(row.vendor) : null, productType: row.productType ? String(row.productType) : null, tags: Array.isArray(row.tags) ? row.tags.map(String) : [], status: String(row.status) as CatalogProduct["status"], media: mediaRows.map((media) => ({ id: String(media.id), url: String(media.url), mimeType: String(media.mimeType), width: media.width == null ? null : Number(media.width), height: media.height == null ? null : Number(media.height), altText: media.altText ? String(media.altText) : null, position: Number(media.position ?? 0) })), variants, priceRange: prices.length ? { minMinor: Math.min(...prices), maxMinor: Math.max(...prices), currency: String(row.storeCurrency ?? "USD") } : null, available: variants.some((variant) => variant.available), primaryCategoryId: row.primaryCategoryId ? String(row.primaryCategoryId) : null, additionalCategoryIds: Array.isArray(row.additionalCategoryIds) ? row.additionalCategoryIds.map(String) : [], brandId: row.brandId ? String(row.brandId) : null, collectionIds: Array.isArray(row.collectionIds) ? row.collectionIds.map(String) : [], options: Array.isArray(row.options) ? row.options : [], inventoryOptionIds: Array.isArray(row.inventoryOptionIds) ? row.inventoryOptionIds.map(String) : [], categoryMetadata: row.categoryMetadata ?? null, brandMetadata: row.brandMetadata ?? null, collectionMetadata: Array.isArray(row.collectionMetadata) ? row.collectionMetadata : [] }; }
}


