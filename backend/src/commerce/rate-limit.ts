import { createHash } from "node:crypto";
import { ApiError } from "../http/errors.js";
import type { CommerceRepository } from "./repository.js";

const WINDOW_MS = 60_000;
const LOOKUP_LIMIT = 5;

interface PublicOrderRateLimitOptions {
  limit?: number;
  now?: () => Date;
}

function startOfWindow(now: Date): Date {
  return new Date(Math.floor(now.getTime() / WINDOW_MS) * WINDOW_MS);
}

function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex");
}

/** PostgreSQL-backed, store-scoped public order lookup limiter. */
export class PublicOrderRateLimiter {
  private readonly limit: number;
  private readonly now: () => Date;

  constructor(private readonly repository: CommerceRepository, options: PublicOrderRateLimitOptions = {}) {
    this.limit = options.limit ?? LOOKUP_LIMIT;
    this.now = options.now ?? (() => new Date());
  }

  async assertAllowed(storeId: string, ip: string): Promise<void> {
    const windowStartedAt = startOfWindow(this.now());
    const ipHash = hashIp(ip);
    const result = await this.repository.transaction((tx) => tx.query(
      `INSERT INTO "PublicOrderAccessRateLimit" ("storeId", "ipHash", "windowStartedAt", "requestCount")
       VALUES ($1, $2, $3, 1)
       ON CONFLICT ("storeId", "ipHash", "windowStartedAt") DO UPDATE
       SET "requestCount" = "PublicOrderAccessRateLimit"."requestCount" + 1
       WHERE "PublicOrderAccessRateLimit"."requestCount" < $4
       RETURNING "requestCount"`,
      [storeId, ipHash, windowStartedAt, this.limit],
    ));
    if (result.rows.length !== 1) {
      throw new ApiError(429, "PUBLIC_ORDER_RATE_LIMITED", "Too many order lookup attempts. Try again shortly.");
    }
  }
}
