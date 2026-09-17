import { createHash } from "node:crypto";

import { ApiError } from "../http/errors.js";
import type { CommerceRepository } from "./repository.js";

const RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_LOOKUP_LIMIT = 5;

interface PublicOrderRateLimitOptions {
  limit?: number;
  now?: () => Date;
}

function getWindowStart(date: Date): Date {
  const timestamp =
    Math.floor(date.getTime() / RATE_LIMIT_WINDOW_MS) *
    RATE_LIMIT_WINDOW_MS;

  return new Date(timestamp);
}

function hashIpAddress(ip: string): string {
  return createHash("sha256")
    .update(ip)
    .digest("hex");
}

export class PublicOrderRateLimiter {
  private readonly limit: number;
  private readonly now: () => Date;

  constructor(
    private readonly repository: CommerceRepository,
    options: PublicOrderRateLimitOptions = {},
  ) {
    this.limit = options.limit ?? DEFAULT_LOOKUP_LIMIT;
    this.now = options.now ?? (() => new Date());
  }

  async assertAllowed(
    storeId: string,
    ip: string,
  ): Promise<void> {
    const windowStartedAt = getWindowStart(this.now());
    const ipHash = hashIpAddress(ip);

    const result = await this.repository.transaction(
      (tx) =>
        tx.query(
          `
            INSERT INTO "PublicOrderAccessRateLimit" (
              "storeId",
              "ipHash",
              "windowStartedAt",
              "requestCount"
            )
            VALUES ($1, $2, $3, 1)

            ON CONFLICT (
              "storeId",
              "ipHash",
              "windowStartedAt"
            )
            DO UPDATE
            SET
              "requestCount" =
                "PublicOrderAccessRateLimit"."requestCount" + 1
            WHERE
              "PublicOrderAccessRateLimit"."requestCount" < $4

            RETURNING "requestCount"
          `,
          [
            storeId,
            ipHash,
            windowStartedAt,
            this.limit,
          ],
        ),
    );

    const allowed = result.rows.length === 1;

    if (!allowed) {
      throw new ApiError(
        429,
        "PUBLIC_ORDER_RATE_LIMITED",
        "Too many order lookup attempts. Try again shortly.",
      );
    }
  }
}