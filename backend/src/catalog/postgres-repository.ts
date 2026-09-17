import type { QueryResultRow } from "pg";
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
  async createProduct(_storeId: string, _input: CreateProductInput): Promise<CatalogProduct> { throw new Error("Catalog writes require the catalog admin adapter"); }
  async updateProduct(_storeId: string, _id: string, _input: UpdateProductInput): Promise<CatalogProduct> { throw new Error("Catalog writes require the catalog admin adapter"); }
  async createCollection(_storeId: string, _input: CreateCollectionInput): Promise<CatalogCollection> { throw new Error("Catalog writes require the catalog admin adapter"); }
  async updateCollection(_storeId: string, _id: string, _input: UpdateCollectionInput): Promise<CatalogCollection> { throw new Error("Catalog writes require the catalog admin adapter"); }

  private variant(row: Row): CatalogVariant { const quantity = row.quantity == null ? null : Number(row.quantity); const reserved = row.reserved == null ? null : Number(row.reserved); return { id: String(row.id), externalId: row.externalId ? String(row.externalId) : null, title: String(row.title), sku: row.sku ? String(row.sku) : null, priceMinor: Number(row.priceMinor), compareAtPriceMinor: row.compareAtPriceMinor == null ? null : Number(row.compareAtPriceMinor), options: (row.options ?? {}) as Record<string, unknown>, trackInventory: Boolean(row.trackInventory), quantity, reserved, available: !Boolean(row.trackInventory) || (quantity !== null && reserved !== null && quantity - reserved > 0) }; }
  private product(row: Row, variantRows: Row[], mediaRows: Row[]): CatalogProduct { const variants = variantRows.map((variant) => this.variant(variant)); const prices = variants.map((variant) => variant.priceMinor); return { id: String(row.id), storeId: String(row.storeId), externalId: row.externalId ? String(row.externalId) : null, handle: String(row.slug), title: String(row.title), description: String(row.description ?? ""), vendor: row.vendor ? String(row.vendor) : null, productType: row.productType ? String(row.productType) : null, tags: Array.isArray(row.tags) ? row.tags.map(String) : [], status: String(row.status) as CatalogProduct["status"], media: mediaRows.map((media) => ({ id: String(media.id), url: String(media.url), mimeType: String(media.mimeType), width: media.width == null ? null : Number(media.width), height: media.height == null ? null : Number(media.height), altText: media.altText ? String(media.altText) : null, position: Number(media.position ?? 0) })), variants, priceRange: prices.length ? { minMinor: Math.min(...prices), maxMinor: Math.max(...prices), currency: "USD" } : null, available: variants.some((variant) => variant.available) }; }
}
