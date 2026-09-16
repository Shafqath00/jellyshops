import { describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { PublicOrderRateLimiter } from "./rate-limit.js";
import { CommerceRepository, type CommerceDatabase, type CommerceTransaction } from "./repository.js";

function repositoryWithCounters() {
  const counters = new Map<string, number>();
  const query = vi.fn(async (_sql: string, values?: unknown[]) => {
    const [storeId, ipHash, windowStart, limit] = values as [string, string, Date, number];
    const key = `${storeId}:${ipHash}:${windowStart.toISOString()}`;
    const count = counters.get(key) ?? 0;
    if (count >= limit) return { rows: [] };
    counters.set(key, count + 1);
    return { rows: [{ requestCount: count + 1 }] };
  });
  const transaction = vi.fn(async (work: (tx: CommerceTransaction) => Promise<unknown>) => work({ query } as unknown as CommerceTransaction));
  return { repository: { transaction } as unknown as CommerceRepository, query };
}

describe("PublicOrderRateLimiter", () => {
  it("rejects the sixth public lookup for one store and IP during a one-minute window", async () => {
    const { repository } = repositoryWithCounters();
    const limiter = new PublicOrderRateLimiter(repository, { limit: 5, now: () => new Date("2026-09-16T12:00:30.000Z") });

    await Promise.all(Array.from({ length: 5 }, () => limiter.assertAllowed("store-1", "203.0.113.9")));

    await expect(limiter.assertAllowed("store-1", "203.0.113.9")).rejects.toMatchObject({ status: 429, code: "PUBLIC_ORDER_RATE_LIMITED" });
  });

  it("keeps a rate-limit budget isolated per store and does not persist the raw IP address", async () => {
    const { repository, query } = repositoryWithCounters();
    const limiter = new PublicOrderRateLimiter(repository, { limit: 1, now: () => new Date("2026-09-16T12:00:30.000Z") });

    await limiter.assertAllowed("store-1", "203.0.113.9");
    await expect(limiter.assertAllowed("store-2", "203.0.113.9")).resolves.toBeUndefined();

    const values = query.mock.calls[0][1] as unknown[];
    expect(values[1]).not.toBe("203.0.113.9");
    expect(values[1]).toMatch(/^[a-f0-9]{64}$/);
  });

  it("uses an atomic PostgreSQL upsert so the stored counter never exceeds the limit", async () => {
    const database = new PGlite();
    try {
      await database.exec(`CREATE TABLE "PublicOrderAccessRateLimit" ("storeId" TEXT NOT NULL, "ipHash" TEXT NOT NULL, "windowStartedAt" TIMESTAMPTZ NOT NULL, "requestCount" INTEGER NOT NULL, PRIMARY KEY ("storeId", "ipHash", "windowStartedAt"))`);
      const commerceDatabase: CommerceDatabase = {
        transaction: (work) => database.transaction((tx) => work({ query: (sql, values) => tx.query(sql, values) })),
      };
      const limiter = new PublicOrderRateLimiter(new CommerceRepository(commerceDatabase), { limit: 5, now: () => new Date("2026-09-16T12:00:30.000Z") });

      for (let index = 0; index < 5; index += 1) await limiter.assertAllowed("store-1", "203.0.113.9");
      await expect(limiter.assertAllowed("store-1", "203.0.113.9")).rejects.toMatchObject({ status: 429 });

      expect((await database.query(`SELECT "requestCount" FROM "PublicOrderAccessRateLimit"`)).rows).toEqual([{ requestCount: 5 }]);
    } finally {
      await database.close();
    }
  }, 15_000);
});
