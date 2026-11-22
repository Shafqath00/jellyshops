import { Router } from "express";
import { ApiError } from "../http/errors.js";
import type { SqlExecutor } from "../commerce/repository.js";

/**
 * Retired shop addresses (table "StoreSlugHistory", migration 20261122040000). A shop that changes its address keeps
 * the old one for good: it redirects to the current address and no other shop can take it. A shop may take its own
 * old address back. Until the migration is applied nothing here runs, and an address can't change once the shop is
 * published or has an order (the earlier rule).
 * Design: docs/plans/2026-11-22-subdomain-tenancy-plan.md §10.
 */
export const ADDRESS_CHANGES_PER_30_DAYS = 3;

let known: boolean | undefined;
/** True once the history table exists. Remembered after the first "yes" (the table is never removed). */
export async function hasSlugHistory(sql: SqlExecutor): Promise<boolean> {
  if (known) return true;
  const result = await sql.query<{ exists: string | null }>(`SELECT to_regclass('public."StoreSlugHistory"')::text AS "exists"`);
  known = Boolean(result.rows[0]?.exists);
  return known;
}

/** For tests: forget whether the table exists. */
export function resetSlugHistoryCheck() { known = undefined; }

/** True when another shop used this address before (so it stays theirs). */
export async function isRetiredAddress(sql: SqlExecutor, slug: string, exceptStoreId?: string): Promise<boolean> {
  if (!await hasSlugHistory(sql)) return false;
  const result = await sql.query(`SELECT 1 FROM "StoreSlugHistory" WHERE "slug" = $1 AND "storeId" IS DISTINCT FROM $2 LIMIT 1`, [slug, exceptStoreId ?? null]);
  return result.rows.length > 0;
}

/**
 * Records an address change inside the caller's transaction (the store row must already be locked): refuses a 4th
 * change within 30 days and an address another shop used before, keeps the old address, and frees the new one if it
 * was this shop's own old address. Returns false when history isn't available (migration not applied).
 */
export async function recordAddressChange(sql: SqlExecutor, storeId: string, oldSlug: string, newSlug: string): Promise<boolean> {
  if (!await hasSlugHistory(sql)) return false;
  const recent = await sql.query<{ count: string }>(
    `SELECT count(*)::text AS "count" FROM "StoreSlugHistory" WHERE "storeId" = $1 AND "retiredAt" > NOW() - INTERVAL '30 days'`,
    [storeId],
  );
  if (Number(recent.rows[0]?.count ?? 0) >= ADDRESS_CHANGES_PER_30_DAYS) {
    throw new ApiError(422, "STORE_SLUG_CHANGE_LIMIT", `A shop's address can change ${ADDRESS_CHANGES_PER_30_DAYS} times in 30 days. Try again later.`);
  }
  if (await isRetiredAddress(sql, newSlug, storeId)) throw new ApiError(422, "STORE_SLUG_TAKEN", "That store address is already in use.");
  await sql.query(`DELETE FROM "StoreSlugHistory" WHERE "slug" = $1 AND "storeId" = $2`, [newSlug, storeId]);
  await sql.query(`INSERT INTO "StoreSlugHistory" ("slug", "storeId", "retiredAt") VALUES ($1, $2, NOW())`, [oldSlug, storeId]);
  return true;
}

/** The current address of the shop that used to be at `slug`, or null. */
export async function currentAddressFor(sql: SqlExecutor, slug: string): Promise<string | null> {
  if (!await hasSlugHistory(sql)) return null;
  const result = await sql.query<{ slug: string }>(
    `SELECT s."slug" FROM "StoreSlugHistory" h JOIN "Store" s ON s."id" = h."storeId" WHERE h."slug" = $1 LIMIT 1`,
    [slug],
  );
  return result.rows[0]?.slug ?? null;
}

/**
 * `GET /api/public/slugs/:slug` → `{ slug }`: where a retired shop address moved to, or 404. The storefront's proxy
 * asks only for addresses that have no shop, and turns the answer into a permanent redirect.
 */
export function createRetiredAddressRouter(db: { transaction<T>(work: (sql: SqlExecutor) => Promise<T>): Promise<T> }): Router {
  const router = Router();
  router.get("/:slug", async (request, response, next) => {
    try {
      const slug = String(request.params.slug).toLowerCase();
      if (!/^[a-z0-9-]{1,63}$/.test(slug)) throw new ApiError(404, "SLUG_NOT_FOUND", "No shop moved from that address.");
      const current = await db.transaction((sql) => currentAddressFor(sql, slug));
      if (!current) throw new ApiError(404, "SLUG_NOT_FOUND", "No shop moved from that address.");
      response.set("Cache-Control", "public, max-age=300").json({ slug: current });
    } catch (error) {
      next(error);
    }
  });
  return router;
}
