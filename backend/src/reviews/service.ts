import { randomUUID } from "node:crypto";
import { ApiError } from "../http/errors.js";

export interface ReviewSql { query<T = Record<string, unknown>>(text: string, values?: unknown[]): Promise<{ rows: T[] }> }

export type ReviewStatus = "pending" | "published" | "hidden";
export const REVIEW_STATUSES: readonly ReviewStatus[] = ["pending", "published", "hidden"];

export interface RatingSummary { average: number; count: number }
export interface ProductRatingSummary extends RatingSummary { /** Published reviews per star, five stars first. */ distribution: [number, number, number, number, number] }
export interface PublicReview { id: string; rating: number; title: string; body: string; authorName: string; verifiedPurchase: boolean; createdAt: string }
export interface MerchantReview extends PublicReview { productId: string; productTitle: string; authorEmail: string | null; status: ReviewStatus; publishedAt: string | null }
export interface ReviewInput { rating: number; title?: string; body?: string; authorName: string; email?: string }

const MAX_SUBMISSIONS = 5;
const SUBMISSION_WINDOW_MS = 10 * 60_000;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const iso = (value: unknown): string => value instanceof Date ? value.toISOString() : String(value);
const isoOrNull = (value: unknown): string | null => value === null || value === undefined ? null : iso(value);

/**
 * Product reviews. Shoppers submit (`submit`, rate limited per store and address, always pending) and read published
 * reviews (`listPublished`, `summaries` for product cards). Merchants list every review with the author's email
 * (`listForMerchant`) and publish, hide or delete them. Every query is scoped by store.
 */
export class ProductReviewService {
  private readonly submissions = new Map<string, number[]>();

  constructor(private readonly sql: ReviewSql, private readonly now: () => number = () => Date.now()) {}

  /** Average rating (one decimal) and count of published reviews for each product asked about; products without reviews are left out. */
  async summaries(storeId: string, productIds: readonly string[]): Promise<Record<string, RatingSummary>> {
    const ids = [...new Set(productIds)].filter(Boolean).slice(0, 100);
    if (!ids.length) return {};
    const { rows } = await this.sql.query<{ productId: string; average: string | number; count: string | number }>(
      `SELECT "productId", AVG("rating")::float AS "average", COUNT(*)::int AS "count" FROM "ProductReview"
       WHERE "storeId" = $1 AND "status" = 'published' AND "productId" = ANY($2::text[]) GROUP BY "productId"`,
      [storeId, ids],
    );
    return Object.fromEntries(rows.map((row) => [row.productId, { average: Math.round(Number(row.average) * 10) / 10, count: Number(row.count) }]));
  }

  /** One product's published reviews, newest first, with its rating summary. */
  async listPublished(storeId: string, productId: string, page: { limit?: number; offset?: number } = {}): Promise<{ summary: ProductRatingSummary; reviews: PublicReview[] }> {
    const limit = Math.max(1, Math.min(50, page.limit ?? 10));
    const offset = Math.max(0, page.offset ?? 0);
    const counts = await this.sql.query<{ rating: number; count: string | number }>(
      `SELECT "rating", COUNT(*)::int AS "count" FROM "ProductReview" WHERE "storeId" = $1 AND "productId" = $2 AND "status" = 'published' GROUP BY "rating"`,
      [storeId, productId],
    );
    const distribution: ProductRatingSummary["distribution"] = [0, 0, 0, 0, 0];
    let total = 0;
    let sum = 0;
    for (const row of counts.rows) {
      const count = Number(row.count);
      distribution[5 - Number(row.rating)] = count;
      total += count;
      sum += count * Number(row.rating);
    }
    const { rows } = await this.sql.query<Record<string, unknown>>(
      `SELECT "id", "rating", "title", "body", "authorName", "verifiedPurchase", "createdAt" FROM "ProductReview"
       WHERE "storeId" = $1 AND "productId" = $2 AND "status" = 'published' ORDER BY "createdAt" DESC, "id" LIMIT $3 OFFSET $4`,
      [storeId, productId, limit, offset],
    );
    return {
      summary: { average: total ? Math.round((sum / total) * 10) / 10 : 0, count: total, distribution },
      reviews: rows.map((row) => ({ id: String(row.id), rating: Number(row.rating), title: String(row.title), body: String(row.body), authorName: String(row.authorName), verifiedPurchase: row.verifiedPurchase === true, createdAt: iso(row.createdAt) })),
    };
  }

  /** A shopper's review of an active product of this store. It waits for the merchant (status pending). */
  async submit(storeId: string, productId: string, input: ReviewInput, address: string): Promise<{ status: "pending" }> {
    const rating = Number(input.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new ApiError(400, "INVALID_RATING", "Choose a rating from 1 to 5 stars.");
    const authorName = input.authorName.trim();
    if (!authorName || authorName.length > 80) throw new ApiError(400, "INVALID_NAME", "Add your name (up to 80 characters).");
    const title = (input.title ?? "").trim();
    const body = (input.body ?? "").trim();
    if (title.length > 120) throw new ApiError(400, "TITLE_TOO_LONG", "The title can be at most 120 characters.");
    if (body.length > 2000) throw new ApiError(400, "REVIEW_TOO_LONG", "The review can be at most 2000 characters.");
    const email = input.email?.trim() || null;
    if (email && (email.length > 254 || !EMAIL.test(email))) throw new ApiError(400, "INVALID_EMAIL", "Check the email address.");
    const product = await this.sql.query(`SELECT 1 FROM "Product" WHERE "id" = $1 AND "storeId" = $2 AND "status" = 'ACTIVE'`, [productId, storeId]);
    if (!product.rows.length) throw new ApiError(404, "PRODUCT_NOT_FOUND", "This product can't be reviewed.");
    this.limit(`${storeId}:${address}`);
    await this.sql.query(
      `INSERT INTO "ProductReview" ("id", "storeId", "productId", "rating", "title", "body", "authorName", "authorEmail") VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [randomUUID(), storeId, productId, rating, title, body, authorName, email],
    );
    return { status: "pending" };
  }

  private limit(key: string): void {
    const now = this.now();
    const recent = (this.submissions.get(key) ?? []).filter((time) => now - time < SUBMISSION_WINDOW_MS);
    if (recent.length >= MAX_SUBMISSIONS) throw new ApiError(429, "TOO_MANY_REVIEWS", "You've sent several reviews in a short time. Please try again later.");
    recent.push(now);
    this.submissions.set(key, recent);
  }

  /** Every review of the store (optionally one status), newest first, with the product's title and the author's email. */
  async listForMerchant(storeId: string, filter: { status?: ReviewStatus; limit?: number; offset?: number } = {}): Promise<{ reviews: MerchantReview[]; counts: Record<ReviewStatus, number> }> {
    const limit = Math.max(1, Math.min(100, filter.limit ?? 50));
    const offset = Math.max(0, filter.offset ?? 0);
    const { rows } = await this.sql.query<Record<string, unknown>>(
      `SELECT r."id", r."productId", p."title" AS "productTitle", r."rating", r."title", r."body", r."authorName", r."authorEmail", r."status", r."verifiedPurchase", r."createdAt", r."publishedAt"
       FROM "ProductReview" r JOIN "Product" p ON p."id" = r."productId" AND p."storeId" = r."storeId"
       WHERE r."storeId" = $1 AND ($2::text IS NULL OR r."status" = $2) ORDER BY r."createdAt" DESC, r."id" LIMIT $3 OFFSET $4`,
      [storeId, filter.status ?? null, limit, offset],
    );
    const counted = await this.sql.query<{ status: ReviewStatus; count: string | number }>(`SELECT "status", COUNT(*)::int AS "count" FROM "ProductReview" WHERE "storeId" = $1 GROUP BY "status"`, [storeId]);
    const counts: Record<ReviewStatus, number> = { pending: 0, published: 0, hidden: 0 };
    for (const row of counted.rows) counts[row.status] = Number(row.count);
    return {
      counts,
      reviews: rows.map((row) => ({
        id: String(row.id), productId: String(row.productId), productTitle: String(row.productTitle), rating: Number(row.rating), title: String(row.title), body: String(row.body),
        authorName: String(row.authorName), authorEmail: row.authorEmail === null ? null : String(row.authorEmail), status: row.status as ReviewStatus,
        verifiedPurchase: row.verifiedPurchase === true, createdAt: iso(row.createdAt), publishedAt: isoOrNull(row.publishedAt),
      })),
    };
  }

  /** Publishes or hides a review; publishing again keeps the first publish date. */
  async setStatus(storeId: string, reviewId: string, status: ReviewStatus): Promise<void> {
    const { rows } = await this.sql.query(
      `UPDATE "ProductReview" SET "status" = $3, "publishedAt" = CASE WHEN $3 = 'published' THEN COALESCE("publishedAt", NOW()) ELSE "publishedAt" END
       WHERE "id" = $1 AND "storeId" = $2 RETURNING "id"`,
      [reviewId, storeId, status],
    );
    if (!rows.length) throw new ApiError(404, "REVIEW_NOT_FOUND", "That review doesn't exist.");
  }

  async remove(storeId: string, reviewId: string): Promise<void> {
    const { rows } = await this.sql.query(`DELETE FROM "ProductReview" WHERE "id" = $1 AND "storeId" = $2 RETURNING "id"`, [reviewId, storeId]);
    if (!rows.length) throw new ApiError(404, "REVIEW_NOT_FOUND", "That review doesn't exist.");
  }
}
