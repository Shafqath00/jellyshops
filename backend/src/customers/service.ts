import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { CommerceDatabase, SqlExecutor } from "../commerce/repository.js";
import { ApiError } from "../http/errors.js";

export interface CustomerIdentity { id: string; email: string; verified: boolean }
interface Profile { id: string; storeId: string; email: string; name: string; revision: number }
interface Address extends Record<string, unknown> { id: string; revision: number }
const text = (max: number) => z.string().trim().min(1).max(max);
const addressSchema = z.object({
  revision: z.number().int().nonnegative().optional(), label: z.string().trim().max(80).default(""),
  name: text(120), line1: text(200), line2: z.string().trim().max(200).default(""), city: text(120),
  region: z.string().trim().max(120).default(""), postalCode: text(24), country: z.enum(["IN", "GB", "US"]),
  phone: z.string().trim().max(32).default(""),
});
const subscribeSchema = z.object({ email: z.email().max(254).transform((value) => value.trim().toLowerCase()), consent: z.literal(true), source: text(80) });
function input<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new ApiError(422, "CUSTOMER_INPUT_INVALID", "Check the submitted information.");
  return result.data;
}
const missing = () => new ApiError(404, "CUSTOMER_RESOURCE_NOT_FOUND", "Resource not found.");
const conflict = () => new ApiError(409, "CUSTOMER_REVISION_CONFLICT", "This record changed. Reload before saving again.");

export class CustomerService {
  constructor(private readonly db: CommerceDatabase, private readonly linkSecret?: string) {}

  private async store(sql: SqlExecutor, storeId: string): Promise<string> {
    const row = (await sql.query<{ country: string }>('SELECT "country" FROM "Store" WHERE "id" = $1 AND "archivedAt" IS NULL', [storeId])).rows[0];
    if (!row) throw missing();
    return row.country;
  }
  private async customer(sql: SqlExecutor, storeId: string, identity: CustomerIdentity): Promise<Profile> {
    if (!identity.verified || !z.uuid().safeParse(identity.id).success || !z.email().safeParse(identity.email).success) throw new ApiError(401, "CUSTOMER_VERIFICATION_REQUIRED", "Verify your email before accessing your customer account.");
    await this.store(sql, storeId);
    const result = await sql.query<Profile>(`INSERT INTO "StoreCustomer" ("id","storeId","authUserId","email") VALUES ($1,$2,$3,$4)
      ON CONFLICT ("storeId","authUserId") DO UPDATE SET "email" = EXCLUDED."email" RETURNING "id","storeId","email","name","revision"`, [randomUUID(), storeId, identity.id, identity.email.toLowerCase()]);
    return result.rows[0];
  }
  profile(storeId: string, identity: CustomerIdentity): Promise<Profile> { return this.db.transaction((sql) => this.customer(sql, storeId, identity)); }
  updateProfile(storeId: string, identity: CustomerIdentity, raw: unknown) {
    const value = input(z.object({ name: text(120), revision: z.number().int().nonnegative() }), raw);
    return this.db.transaction(async (sql) => {
      const customer = await this.customer(sql, storeId, identity);
      const result = await sql.query<Profile>('UPDATE "StoreCustomer" SET "name"=$3,"revision"="revision"+1,"updatedAt"=NOW() WHERE "storeId"=$1 AND "id"=$2 AND "revision"=$4 RETURNING "id","storeId","email","name","revision"', [storeId, customer.id, value.name, value.revision]);
      if (!result.rows.length) throw conflict(); return result.rows[0];
    });
  }
  addresses(storeId: string, identity: CustomerIdentity) {
    return this.db.transaction(async (sql) => { const customer = await this.customer(sql, storeId, identity); return (await sql.query<Address>('SELECT * FROM "CustomerAddress" WHERE "storeId"=$1 AND "customerId"=$2 ORDER BY "createdAt","id"', [storeId, customer.id])).rows; });
  }
  saveAddress(storeId: string, identity: CustomerIdentity, id: string | undefined, raw: unknown): Promise<Address> {
    const value = input(addressSchema, raw);
    return this.db.transaction(async (sql) => {
      const customer = await this.customer(sql, storeId, identity);
      const storeCountry = await this.store(sql, storeId);
      if (value.country !== storeCountry) throw new ApiError(422, "CUSTOMER_ADDRESS_COUNTRY_INVALID", "Saved addresses must be within the store's delivery country.");
      const fields = [value.label, value.name, value.line1, value.line2, value.city, value.region, value.postalCode, value.country, value.phone];
      if (id) {
        const existing = await sql.query<Address>('SELECT "id","revision" FROM "CustomerAddress" WHERE "storeId"=$1 AND "customerId"=$2 AND "id"=$3 FOR UPDATE', [storeId, customer.id, id]);
        if (!existing.rows.length) throw missing();
        if (value.revision === undefined || existing.rows[0].revision !== value.revision) throw conflict();
        return (await sql.query<Address>('UPDATE "CustomerAddress" SET "label"=$4,"name"=$5,"line1"=$6,"line2"=$7,"city"=$8,"region"=$9,"postalCode"=$10,"country"=$11,"phone"=$12,"revision"="revision"+1,"updatedAt"=NOW() WHERE "storeId"=$1 AND "customerId"=$2 AND "id"=$3 RETURNING *', [storeId, customer.id, id, ...fields])).rows[0];
      }
      const count = await sql.query<{ count: number }>('SELECT COUNT(*)::int AS count FROM "CustomerAddress" WHERE "storeId"=$1 AND "customerId"=$2', [storeId, customer.id]);
      if (count.rows[0].count >= 20) throw new ApiError(422, "ADDRESS_LIMIT", "You can save up to 20 addresses.");
      return (await sql.query<Address>('INSERT INTO "CustomerAddress" ("storeId","customerId","id","label","name","line1","line2","city","region","postalCode","country","phone") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *', [storeId, customer.id, randomUUID(), ...fields])).rows[0];
    });
  }
  deleteAddress(storeId: string, identity: CustomerIdentity, id: string, revision: number) {
    return this.db.transaction(async (sql) => {
      const customer = await this.customer(sql, storeId, identity);
      const existing = await sql.query<Address>('SELECT "id","revision" FROM "CustomerAddress" WHERE "storeId"=$1 AND "customerId"=$2 AND "id"=$3 FOR UPDATE', [storeId, customer.id, id]);
      if (!existing.rows.length) throw missing(); if (existing.rows[0].revision !== revision) throw conflict();
      await sql.query('DELETE FROM "CustomerAddress" WHERE "storeId"=$1 AND "customerId"=$2 AND "id"=$3', [storeId, customer.id, id]);
    });
  }
  orders(storeId: string, identity: CustomerIdentity, id?: string) {
    return this.db.transaction(async (sql) => {
      const customer = await this.customer(sql, storeId, identity);
      const result = await sql.query('SELECT "id","number","status","currency","subtotalMinor","shippingMinor","totalMinor","customerSnapshot","createdAt" FROM "Order" WHERE "storeId"=$1 AND "customerId"=$2 AND ($3::text IS NULL OR "id"=$3) ORDER BY "createdAt" DESC,"id" LIMIT 100', [storeId, customer.id, id ?? null]);
      if (id && !result.rows.length) throw missing();
      if (id) return { ...result.rows[0], items: (await sql.query('SELECT "variantId","titleSnapshot","skuSnapshot","imageSnapshot","quantity","unitPriceMinor",("quantity" * "unitPriceMinor") AS "lineTotalMinor","configurationSnapshot" FROM "OrderItem" WHERE "storeId"=$1 AND "orderId"=$2 ORDER BY "variantId"', [storeId, id])).rows };
      return result.rows;
    });
  }
  wishlist(storeId: string, identity: CustomerIdentity, merge?: string[]) {
    const ids = merge === undefined ? undefined : input(z.array(text(160)).max(100), merge);
    return this.db.transaction(async (sql) => {
      const customer = await this.customer(sql, storeId, identity);
      if (ids) {
        const current = await sql.query<{ productId: string }>('SELECT "productId" FROM "CustomerWishlist" WHERE "storeId"=$1 AND "customerId"=$2', [storeId, customer.id]);
        if (new Set([...current.rows.map((row) => row.productId), ...ids]).size > 100) throw new ApiError(422, "WISHLIST_LIMIT", "You can save up to 100 products.");
        await sql.query('INSERT INTO "CustomerWishlist" ("storeId","customerId","productId") SELECT $1,$2,"id" FROM "Product" WHERE "storeId"=$1 AND "id"=ANY($3::text[]) ON CONFLICT DO NOTHING', [storeId, customer.id, ids]);
      }
      return (await sql.query('SELECT w."productId",p."title",p."slug",p."status" FROM "CustomerWishlist" w JOIN "Product" p ON p."storeId"=w."storeId" AND p."id"=w."productId" WHERE w."storeId"=$1 AND w."customerId"=$2 ORDER BY w."createdAt",w."productId"', [storeId, customer.id])).rows;
    });
  }
  removeWishlistItem(storeId: string, identity: CustomerIdentity, productId: string) {
    return this.db.transaction(async (sql) => { const customer = await this.customer(sql, storeId, identity); await sql.query('DELETE FROM "CustomerWishlist" WHERE "storeId"=$1 AND "customerId"=$2 AND "productId"=$3', [storeId, customer.id, productId]); });
  }
  private signature(payload: string): string {
    if (!this.linkSecret || this.linkSecret.length < 32) throw new ApiError(503, "CUSTOMER_LINKS_UNAVAILABLE", "Subscriptions are temporarily unavailable.");
    return createHmac("sha256", this.linkSecret).update(payload).digest("base64url");
  }
  private unsubscribeToken(storeId: string, subscriberId: string): string {
    const payload = Buffer.from(JSON.stringify([storeId, subscriberId])).toString("base64url");
    return `${payload}.${this.signature(payload)}`;
  }
  async subscribe(storeId: string, raw: unknown): Promise<{ token: string }> {
    const value = input(subscribeSchema, raw);
    this.signature("");
    return this.db.transaction(async (sql) => {
      await this.store(sql, storeId);
      const result = await sql.query<{ id: string }>(`INSERT INTO "NewsletterSubscriber" ("id","storeId","email","source") VALUES ($1,$2,$3,$4)
        ON CONFLICT ("storeId","email") DO UPDATE SET "consentAt"=CASE WHEN "NewsletterSubscriber"."unsubscribedAt" IS NULL THEN "NewsletterSubscriber"."consentAt" ELSE NOW() END,"unsubscribedAt"=NULL,"source"=EXCLUDED."source" RETURNING "id"`, [randomUUID(), storeId, value.email, value.source]);
      return { token: this.unsubscribeToken(storeId, result.rows[0].id) };
    });
  }
  async unsubscribe(storeId: string, token: string): Promise<void> {
    const [payload, signature, extra] = token.split(".");
    if (!payload || !signature || extra || token.length > 512) throw new ApiError(422, "UNSUBSCRIBE_INVALID", "This unsubscribe link is invalid.");
    const expected = this.signature(payload);
    if (Buffer.byteLength(signature) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw new ApiError(422, "UNSUBSCRIBE_INVALID", "This unsubscribe link is invalid.");
    let data: unknown;
    try { data = JSON.parse(Buffer.from(payload, "base64url").toString()); } catch { throw new ApiError(422, "UNSUBSCRIBE_INVALID", "This unsubscribe link is invalid."); }
    if (!Array.isArray(data) || data.length !== 2 || data[0] !== storeId || typeof data[1] !== "string") throw new ApiError(422, "UNSUBSCRIBE_INVALID", "This unsubscribe link is invalid.");
    await this.db.transaction(async (sql) => { await sql.query('UPDATE "NewsletterSubscriber" SET "unsubscribedAt"=COALESCE("unsubscribedAt",NOW()) WHERE "storeId"=$1 AND "id"=$2', [storeId, data[1]]); });
  }
  contact(storeId: string, raw: unknown) {
    const value = input(z.object({ name: text(120), email: z.email().max(254), message: text(5000) }), raw);
    return this.db.transaction(async (sql) => { await this.store(sql, storeId); await sql.query('INSERT INTO "ContactEnquiry" ("id","storeId","name","email","message") VALUES ($1,$2,$3,$4,$5)', [randomUUID(), storeId, value.name, value.email.toLowerCase(), value.message]); });
  }
  subscribers(storeId: string) { return this.db.transaction(async (sql) => {
    const rows = (await sql.query<{ id: string; slug: string; email: string; consentAt: Date; source: string; unsubscribedAt: Date | null }>('SELECT n."id",s."slug",n."email",n."consentAt",n."source",n."unsubscribedAt" FROM "NewsletterSubscriber" n JOIN "Store" s ON s."id"=n."storeId" WHERE n."storeId"=$1 ORDER BY n."email"', [storeId])).rows;
    return rows.map(({ id, slug, ...row }) => ({ ...row, unsubscribeUrl: `/${encodeURIComponent(slug)}/newsletter/unsubscribe?token=${encodeURIComponent(this.unsubscribeToken(storeId, id))}` }));
  }); }
  enquiries(storeId: string) { return this.db.transaction(async (sql) => (await sql.query('SELECT * FROM "ContactEnquiry" WHERE "storeId"=$1 ORDER BY "createdAt" DESC,"id" LIMIT 100', [storeId])).rows); }
  updateEnquiry(storeId: string, id: string, raw: unknown) {
    const value = input(z.object({ revision: z.number().int().nonnegative(), status: z.enum(["NEW", "READ", "CLOSED"]) }), raw);
    return this.db.transaction(async (sql) => {
      const row = (await sql.query('SELECT "revision" FROM "ContactEnquiry" WHERE "storeId"=$1 AND "id"=$2 FOR UPDATE', [storeId, id])).rows[0];
      if (!row) throw missing(); if (row.revision !== value.revision) throw conflict();
      return (await sql.query('UPDATE "ContactEnquiry" SET "status"=$3,"revision"="revision"+1,"updatedAt"=NOW() WHERE "storeId"=$1 AND "id"=$2 RETURNING *', [storeId, id, value.status])).rows[0];
    });
  }
}
