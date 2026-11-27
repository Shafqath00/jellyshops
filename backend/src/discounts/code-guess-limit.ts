import { createHash } from "node:crypto";
import { ApiError } from "../http/errors.js";

/**
 * Stops people guessing discount codes: after `limit` wrong codes from one address in one shop within `windowMs`,
 * every code check from that address is refused until the window has passed. Kept in memory per server (each server
 * enforces its own count; the per-minute database limit on the check route still applies everywhere). Right codes
 * never count, and nothing about which codes exist is revealed: every wrong code gets the same words.
 */
export class DiscountGuessLimiter {
  private readonly wrong = new Map<string, number[]>();

  constructor(private readonly options: { limit?: number; windowMs?: number; now?: () => number } = {}) {}

  private key(storeId: string, ip: string) {
    return createHash("sha256").update(JSON.stringify([storeId, ip])).digest("hex");
  }

  private recent(key: string): number[] {
    const now = (this.options.now ?? Date.now)();
    const kept = (this.wrong.get(key) ?? []).filter((at) => now - at < (this.options.windowMs ?? 10 * 60_000));
    if (kept.length) this.wrong.set(key, kept); else this.wrong.delete(key);
    return kept;
  }

  /** Throws a 429 when this address has tried too many wrong codes in this shop. */
  assertAllowed(storeId: string, ip: string): void {
    if (this.recent(this.key(storeId, ip)).length >= (this.options.limit ?? 10)) {
      throw new ApiError(429, "DISCOUNT_TOO_MANY_TRIES", "Too many codes tried. Wait a few minutes and try again.");
    }
  }

  recordWrong(storeId: string, ip: string): void {
    const key = this.key(storeId, ip);
    const kept = this.recent(key);
    kept.push((this.options.now ?? Date.now)());
    this.wrong.set(key, kept);
    // Keep memory bounded on a busy server.
    if (this.wrong.size > 50_000) this.wrong.delete(this.wrong.keys().next().value!);
  }
}

/** Runs a code check, counting a wrong or unusable code against the address. */
export async function withGuessLimit<T>(limiter: DiscountGuessLimiter, storeId: string, ip: string, hasCode: boolean, work: () => Promise<T>): Promise<T> {
  if (!hasCode) return work();
  limiter.assertAllowed(storeId, ip);
  try {
    return await work();
  } catch (error) {
    if (error instanceof ApiError && (error.code === "DISCOUNT_NOT_FOUND" || error.code === "DISCOUNT_NOT_APPLICABLE")) limiter.recordWrong(storeId, ip);
    throw error;
  }
}
