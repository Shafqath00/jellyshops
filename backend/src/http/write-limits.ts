import { WRITE_LIMITS } from "../billing/limits-config.js";
import { ApiError } from "./errors.js";

/**
 * Rate limit for changes to a shop (docs/plans/2026-11-25-billing-trial-limits.md, step 4). Fixed windows per person
 * and per shop; both must have room. Reads are never counted. Applied by `requireStorePermission`, which every
 * `/api/stores/:storeId/...` route uses after sign-in.
 */

const READS = new Set(["GET", "HEAD", "OPTIONS"]);

interface Window { start: number; count: number }

export interface WriteLimitOptions { windowMs: number; perUser: number; perStore: number; now?: () => number }

export class WriteLimiter {
  private readonly windows = new Map<string, Window>();
  private lastSweep = 0;

  constructor(private readonly options: WriteLimitOptions = WRITE_LIMITS) {}

  private now() { return this.options.now?.() ?? Date.now(); }

  /** Counts one change. Returns null when allowed, or the seconds to wait. A refused change is not counted. */
  take(userId: string, storeId: string): number | null {
    const now = this.now();
    this.sweep(now);
    const keys: Array<[string, number]> = [[`user:${userId}`, this.options.perUser], [`store:${storeId}`, this.options.perStore]];
    let wait = 0;
    for (const [key, limit] of keys) {
      const window = this.current(key, now);
      if (window.count >= limit) wait = Math.max(wait, window.start + this.options.windowMs - now);
    }
    if (wait > 0) return Math.max(1, Math.ceil(wait / 1000));
    for (const [key] of keys) this.current(key, now).count += 1;
    return null;
  }

  private current(key: string, now: number): Window {
    let window = this.windows.get(key);
    if (!window || now - window.start >= this.options.windowMs) {
      window = { start: now, count: 0 };
      this.windows.set(key, window);
    }
    return window;
  }

  private sweep(now: number) {
    if (now - this.lastSweep < this.options.windowMs) return;
    this.lastSweep = now;
    for (const [key, window] of this.windows) if (now - window.start >= this.options.windowMs) this.windows.delete(key);
  }
}

export const writeLimiter = new WriteLimiter();

export function tooManyChanges(retryAfterSeconds: number): ApiError {
  return new ApiError(429, "WRITE_RATE_LIMIT", `You're making changes very quickly. Wait ${retryAfterSeconds} ${retryAfterSeconds === 1 ? "second" : "seconds"} and try again.`);
}

export const isWrite = (method: string) => !READS.has(method);
