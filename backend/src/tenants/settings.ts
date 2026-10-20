import { Router } from "express";
import { z } from "zod";
import { requireMerchant, requireStorePermission } from "../auth/middleware.js";
import type { AuthProvider } from "../auth/types.js";
import type { CommerceDatabase, SqlExecutor } from "../commerce/repository.js";
import { ApiError } from "../http/errors.js";

export const MARKET_CURRENCIES: Readonly<Record<string, string>> = { IN: "INR", GB: "GBP", US: "USD" };
export interface CheckoutPolicy { currency: string; country: string; shippingMinor: number }
export interface StoreSettings extends CheckoutPolicy {
  id: string; name: string; slug: string; contactEmail: string | null; timezone: string; revision: number; shippingCopy: string;
}
const patchSchema = z.object({
  revision: z.number().int().nonnegative(),
  name: z.string().trim().min(1).max(120).optional(),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(3).max(63).optional(),
  contactEmail: z.email().nullable().optional(),
  timezone: z.string().refine((value) => { try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; } }).optional(),
  shippingMinor: z.number().int().nonnegative().max(2147483647).optional(),
  shippingCopy: z.string().trim().max(500).optional(),
}).strict();
type Patch = z.infer<typeof patchSchema>;

export class StoreSettingsRepository {
  constructor(private readonly db: CommerceDatabase) {}

  private async read(sql: SqlExecutor, storeId: string): Promise<StoreSettings> {
    const result = await sql.query<StoreSettings>(`SELECT s."id", s."name", s."slug", s."currency", s."country", ss."contactEmail", COALESCE(ss."timezone", 'UTC') AS timezone, COALESCE(ss."revision", 0) AS revision, COALESCE(ss."shippingMinor", 0) AS "shippingMinor", COALESCE(ss."shippingCopy", '') AS "shippingCopy" FROM "Store" s LEFT JOIN "StoreSettings" ss ON ss."storeId" = s."id" WHERE s."id" = $1 AND s."archivedAt" IS NULL`, [storeId]);
    if (!result.rows[0]) throw new ApiError(404, "STORE_NOT_FOUND", "Store not found.");
    return result.rows[0];
  }
  get(storeId: string): Promise<StoreSettings> { return this.db.transaction((sql) => this.read(sql, storeId)); }
  async getCheckoutPolicy(storeId: string): Promise<CheckoutPolicy> {
    const store = await this.get(storeId);
    if (MARKET_CURRENCIES[store.country] !== store.currency) throw new ApiError(409, "STORE_MARKET_INVALID", "This store's country and currency require review before checkout can open.");
    return { currency: store.currency, country: store.country, shippingMinor: store.shippingMinor };
  }
  async update(storeId: string, raw: Patch): Promise<StoreSettings> {
    const parsed = patchSchema.safeParse(raw);
    if (!parsed.success) throw new ApiError(422, "SETTINGS_INVALID", "Check the store settings and try again.");
    const input = parsed.data;
    try {
      return await this.db.transaction(async (sql) => {
        await sql.query(`SELECT "id" FROM "Store" WHERE "id" = $1 FOR UPDATE`, [storeId]);
        const current = await this.read(sql, storeId);
        if (current.revision !== input.revision) throw new ApiError(409, "SETTINGS_REVISION_CONFLICT", "Settings changed in another session. Reload before saving.");
        if (input.slug !== undefined && input.slug !== current.slug) {
          const used = await sql.query(`SELECT 1 FROM "StorefrontPublication" WHERE "storeId" = $1 UNION ALL SELECT 1 FROM "Order" WHERE "storeId" = $1 LIMIT 1`, [storeId]);
          if (used.rows.length) throw new ApiError(422, "STORE_SLUG_LOCKED", "The store address cannot change after publication or an order.");
        }
        await sql.query(`UPDATE "Store" SET "name" = $2, "slug" = $3, "updatedAt" = NOW() WHERE "id" = $1`, [storeId, input.name ?? current.name, input.slug ?? current.slug]);
        await sql.query(`INSERT INTO "StoreSettings" ("storeId", "contactEmail", "timezone", "shippingMinor", "shippingCopy", "revision") VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT ("storeId") DO UPDATE SET "contactEmail" = EXCLUDED."contactEmail", "timezone" = EXCLUDED."timezone", "shippingMinor" = EXCLUDED."shippingMinor", "shippingCopy" = EXCLUDED."shippingCopy", "revision" = EXCLUDED."revision"`, [storeId, input.contactEmail === undefined ? current.contactEmail : input.contactEmail, input.timezone ?? current.timezone, input.shippingMinor ?? current.shippingMinor, input.shippingCopy ?? current.shippingCopy, current.revision + 1]);
        return this.read(sql, storeId);
      });
    } catch (error) {
      if ((error as { code?: string }).code === "23505") throw new ApiError(422, "STORE_SLUG_TAKEN", "That store address is already in use.");
      throw error;
    }
  }
}

export function createStoreSettingsRouter(auth: AuthProvider, settings: StoreSettingsRepository): Router {
  const router = Router({ mergeParams: true });
  router.use(requireMerchant(auth), requireStorePermission("settings:manage"));
  router.get<{ storeId: string }>("/", async (request, response) => { response.setHeader("Cache-Control", "no-store"); response.json({ settings: await settings.get(String(request.params.storeId)) }); });
  router.patch<{ storeId: string }>("/", async (request, response) => { response.setHeader("Cache-Control", "no-store"); response.json({ settings: await settings.update(String(request.params.storeId), request.body) }); });
  return router;
}
