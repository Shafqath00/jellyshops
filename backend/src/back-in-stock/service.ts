import { randomUUID } from "node:crypto";
import { ApiError } from "../http/errors.js";
import type { NotificationTransport } from "../commerce/notifications.js";

export interface BackInStockSql { query<T = Record<string, unknown>>(text: string, values?: unknown[]): Promise<{ rows: T[] }> }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_REQUESTS = 5;
const WINDOW_MS = 10 * 60_000;

const escape = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);

/**
 * Back-in-stock alerts. Shoppers ask (`request`) for a sold-out variant of an active product; one email is sent
 * when it can be bought again (`notifyAvailable`, run by the scheduled order worker), then the request ends.
 * Merchants see how many shoppers are waiting per variant (`waitingCounts`). Every query is scoped by store.
 */
export class BackInStockService {
  private readonly attempts = new Map<string, number[]>();

  constructor(
    private readonly sql: BackInStockSql,
    private readonly transport?: NotificationTransport,
    private readonly publicBaseUrl = "",
    private readonly now: () => number = () => Date.now(),
  ) {}

  /** Records a request. The answer is the same whether or not the shopper already asked, so it reveals nothing. */
  async request(storeId: string, variantId: string, email: string, address: string): Promise<{ status: "waiting" }> {
    const cleaned = email.trim();
    if (cleaned.length > 254 || !EMAIL.test(cleaned)) throw new ApiError(400, "INVALID_EMAIL", "Check the email address.");
    const { rows } = await this.sql.query<{ productId: string; available: boolean }>(
      `SELECT v."productId", (v."sellable" IS DISTINCT FROM FALSE AND (NOT v."trackInventory" OR COALESCE(i."quantity", 0) - COALESCE(i."reserved", 0) > 0)) AS "available"
       FROM "ProductVariant" v JOIN "Product" p ON p."id" = v."productId" AND p."storeId" = v."storeId"
       LEFT JOIN "InventoryLevel" i ON i."storeId" = v."storeId" AND i."variantId" = v."id"
       WHERE v."storeId" = $1 AND v."id" = $2 AND v."archivedAt" IS NULL AND p."status" = 'ACTIVE'`,
      [storeId, variantId],
    );
    const variant = rows[0];
    if (!variant) throw new ApiError(404, "PRODUCT_NOT_FOUND", "This product can't be found.");
    if (variant.available) throw new ApiError(409, "IN_STOCK", "Good news: this is in stock now.");
    this.limit(`${storeId}:${address}`);
    await this.sql.query(
      `INSERT INTO "BackInStockRequest" ("id", "storeId", "productId", "variantId", "email") VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT ("storeId", "variantId", lower("email")) WHERE "status" = 'waiting' DO NOTHING`,
      [randomUUID(), storeId, variant.productId, variantId, cleaned],
    );
    return { status: "waiting" };
  }

  private limit(key: string): void {
    const now = this.now();
    const recent = (this.attempts.get(key) ?? []).filter((time) => now - time < WINDOW_MS);
    if (recent.length >= MAX_REQUESTS) throw new ApiError(429, "TOO_MANY_REQUESTS", "You've asked several times in a short time. Please try again later.");
    recent.push(now);
    this.attempts.set(key, recent);
  }

  /** Shoppers waiting per variant of the store's products, for the admin. */
  async waitingCounts(storeId: string): Promise<Array<{ productId: string; variantId: string; waiting: number }>> {
    const { rows } = await this.sql.query<{ productId: string; variantId: string; waiting: number | string }>(
      `SELECT "productId", "variantId", COUNT(*)::int AS "waiting" FROM "BackInStockRequest" WHERE "storeId" = $1 AND "status" = 'waiting' GROUP BY "productId", "variantId" ORDER BY "productId", "variantId"`,
      [storeId],
    );
    return rows.map((row) => ({ productId: row.productId, variantId: row.variantId, waiting: Number(row.waiting) }));
  }

  /**
   * Emails up to `limit` shoppers whose variant can be bought again, across stores. Each request is claimed before
   * sending, so two workers never email the same shopper; a failed send is marked and not retried.
   */
  async notifyAvailable(limit = 50): Promise<{ sent: number; failed: number; configured: boolean }> {
    if (!this.transport) return { sent: 0, failed: 0, configured: false };
    const { rows } = await this.sql.query<{ id: string; email: string; storeName: string; storeSlug: string; productTitle: string; productSlug: string; variantTitle: string }>(
      `UPDATE "BackInStockRequest" r SET "status" = 'notified', "notifiedAt" = NOW()
       FROM "ProductVariant" v, "Product" p, "Store" s
       WHERE r."id" IN (
         SELECT r2."id" FROM "BackInStockRequest" r2
         JOIN "ProductVariant" v2 ON v2."id" = r2."variantId" AND v2."storeId" = r2."storeId"
         JOIN "Product" p2 ON p2."id" = r2."productId" AND p2."storeId" = r2."storeId"
         LEFT JOIN "InventoryLevel" i ON i."storeId" = v2."storeId" AND i."variantId" = v2."id"
         WHERE r2."status" = 'waiting' AND p2."status" = 'ACTIVE' AND v2."archivedAt" IS NULL AND v2."sellable" IS DISTINCT FROM FALSE
           AND (NOT v2."trackInventory" OR COALESCE(i."quantity", 0) - COALESCE(i."reserved", 0) > 0)
         ORDER BY r2."createdAt" LIMIT $1 FOR UPDATE OF r2 SKIP LOCKED
       )
       AND v."id" = r."variantId" AND p."id" = r."productId" AND s."id" = r."storeId"
       RETURNING r."id", r."email", s."name" AS "storeName", s."slug" AS "storeSlug", p."title" AS "productTitle", p."slug" AS "productSlug", v."title" AS "variantTitle"`,
      [limit],
    );
    let sent = 0;
    let failed = 0;
    for (const row of rows) {
      try {
        await this.transport.send(this.message(row));
        sent += 1;
      } catch {
        failed += 1;
        await this.sql.query(`UPDATE "BackInStockRequest" SET "status" = 'failed' WHERE "id" = $1`, [row.id]);
      }
    }
    return { sent, failed, configured: true };
  }

  private message(row: { id: string; email: string; storeName: string; storeSlug: string; productTitle: string; productSlug: string; variantTitle: string }) {
    const name = row.variantTitle && row.variantTitle !== "Default" && row.variantTitle !== "Standard" ? `${row.productTitle} (${row.variantTitle})` : row.productTitle;
    const url = `${this.publicBaseUrl.replace(/\/$/, "")}/${encodeURIComponent(row.storeSlug)}/products/${encodeURIComponent(row.productSlug)}`;
    const subject = `${name} is back at ${row.storeName}`;
    const text = `Good news: ${name} is back in stock at ${row.storeName}.\n\nBuy it here: ${url}\n\nYou asked us to tell you once. We won't email you about it again.`;
    const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f6f4ef;font-family:Arial,Helvetica,sans-serif;color:#14213d">
<table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px"><tr><td style="padding:32px">
<p style="margin:0 0 8px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#45516a">${escape(row.storeName)}</p>
<h1 style="margin:0 0 16px;font-size:24px;line-height:30px">${escape(name)} is back in stock</h1>
<p style="margin:0 0 24px;font-size:15px;line-height:23px">You asked us to let you know. It may sell out again, so don't wait too long.</p>
<p style="margin:0 0 24px"><a href="${escape(url)}" style="display:inline-block;padding:12px 20px;border-radius:6px;background:#14213d;color:#ffffff;text-decoration:none;font-weight:bold">View the product</a></p>
<p style="margin:0;font-size:13px;line-height:20px;color:#45516a">We only send this email once.</p>
</td></tr></table></body></html>`;
    return { id: `back-in-stock-${row.id}`, to: row.email, subject, html, text };
  }
}
