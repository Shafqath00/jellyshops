import { describe, expect, it, vi } from "vitest";
import { billingState, pausedShopCheckoutGuard, pauseReason, startTrial, StoreBillingService, TRIAL_DAYS, type StoreBillingRecord } from "./store-billing.js";

const now = new Date("2026-12-01T12:00:00Z");
const day = 24 * 60 * 60 * 1000;
const record = (overrides: Partial<StoreBillingRecord>): StoreBillingRecord => ({
  storeId: "s", plan: "standard", status: "active", trialEndsAt: null, currentPeriodEnd: null, cancelAtPeriodEnd: false, ...overrides,
});

describe("when a shop is out of good standing", () => {
  it("never for a shop without billing (before the migration), an exempt or a paying shop, or while Stripe retries", () => {
    expect(pauseReason(null, now)).toBeNull();
    for (const status of ["exempt", "active", "past_due"] as const) expect(pauseReason(record({ status }), now)).toBeNull();
  });

  it("when the trial has ended, not before", () => {
    expect(pauseReason(record({ status: "trialing", trialEndsAt: new Date(now.getTime() + day) }), now)).toBeNull();
    expect(pauseReason(record({ status: "trialing", trialEndsAt: now }), now)).toBe("trial-ended");
  });

  it("when a cancelled plan has run out, and when payment stopped", () => {
    expect(pauseReason(record({ status: "canceled", currentPeriodEnd: new Date(now.getTime() + day) }), now)).toBeNull();
    expect(pauseReason(record({ status: "canceled", currentPeriodEnd: new Date(now.getTime() - day) }), now)).toBe("canceled");
    expect(pauseReason(record({ status: "paused" }), now)).toBe("payment-stopped");
  });

  it("only closes the shop when BILLING_ENFORCED is on", () => {
    const ended = record({ status: "trialing", trialEndsAt: new Date(now.getTime() - day) });
    expect(billingState(ended, now, false)).toMatchObject({ status: "trialing", pauseReason: "trial-ended", paused: false });
    expect(billingState(ended, now, true)).toMatchObject({ pauseReason: "trial-ended", paused: true });
    expect(billingState(null, now, true)).toMatchObject({ status: "none", plan: "standard", paused: false });
  });
});

describe("starting the trial", () => {
  it("adds a 14-day trial row when the table exists, and does nothing before the migration", async () => {
    const query = vi.fn(async (text: string) => ({ rows: text.includes("to_regclass") ? [{ table: "\"StoreBilling\"" }] : [] }));
    await startTrial({ query }, "store-1", now);
    expect(query).toHaveBeenLastCalledWith(expect.stringContaining(`INSERT INTO "StoreBilling"`), ["store-1", "standard", new Date(now.getTime() + TRIAL_DAYS * day)]);

    const before = vi.fn(async () => ({ rows: [{ table: null }] }));
    await startTrial({ query: before }, "store-1", now);
    expect(before).toHaveBeenCalledTimes(1);
  });
});

describe("StoreBillingService", () => {
  const service = (rows: unknown[], enforced = true) =>
    new StoreBillingService({ query: vi.fn(async () => ({ rows })) }, { enforced, now: () => now });

  it("reads the stored state, plans for limits and whether the shop is closed", async () => {
    const ended = service([{ storeId: "s", plan: "standard", status: "trialing", trialEndsAt: "2026-11-30T00:00:00Z", currentPeriodEnd: null, cancelAtPeriodEnd: false }]);
    expect(await ended.isPaused("s")).toBe(true);
    // An ended trial keeps the trial limits until the shop pays.
    expect(await ended.planFor("s")).toBe("trial");
    expect(await service([{ storeId: "s", plan: "standard", status: "exempt", trialEndsAt: null, currentPeriodEnd: null, cancelAtPeriodEnd: false }]).planFor("s")).toBe("exempt");
    expect(await service([], false).isPaused("s")).toBe(false);
  });

  it("treats a missing table as 'no billing yet' and stops asking", async () => {
    const query = vi.fn(async () => { throw Object.assign(new Error("relation does not exist"), { code: "42P01" }); });
    const billing = new StoreBillingService({ query }, { enforced: true });
    expect(await billing.isPaused("s")).toBe(false);
    expect(await billing.planFor("s")).toBe("standard");
    expect(query).toHaveBeenCalledTimes(1);
  });
});

describe("checkout in a paused shop", () => {
  const run = async (method: string, isPaused: () => Promise<boolean>) => {
    const next = vi.fn();
    pausedShopCheckoutGuard({ isPaused })({ method, params: { storeId: "s" } } as never, {} as never, next);
    await new Promise((resolve) => setTimeout(resolve, 0));
    return next.mock.calls[0]?.[0];
  };

  it("refuses new orders with a plain message, but still lets shoppers read their checkout", async () => {
    expect(await run("POST", async () => true)).toMatchObject({ status: 403, code: "SHOP_PAUSED", message: "This shop isn't taking orders right now." });
    expect(await run("GET", async () => true)).toBeUndefined();
    expect(await run("POST", async () => false)).toBeUndefined();
  });

  it("never closes a shop because the billing lookup failed", async () => {
    expect(await run("POST", async () => { throw new Error("database down"); })).toBeUndefined();
  });
});

describe("GET /api/stores/:storeId/billing", () => {
  const owner = { verify: async () => ({ userId: "u1", storeIds: ["s"], storeRoles: { s: "OWNER" as const } }) };
  const app = async (state: Partial<ReturnType<typeof billingState>>) => {
    const { default: express } = await import("express");
    const { createBillingRouter } = await import("./routes.js");
    const { errorHandler } = await import("../http/errors.js");
    const limits = { usage: vi.fn(async (_storeId: string, kind: "products" | "photoBytes" | "files") => ({ plan: "standard" as const, kind, used: { products: 74, photoBytes: 1024, files: 12 }[kind], limit: { products: 5000, photoBytes: 10 * 1024 ** 3, files: 5000 }[kind] })) };
    return express()
      .use("/api/stores/:storeId", createBillingRouter({ state: async () => ({ ...billingState(null, now, false), ...state }) }, limits, owner, { enforced: false }))
      .use(errorHandler);
  };

  it("shows the owner their plan, trial and usage, never cached", async () => {
    const { default: request } = await import("supertest");
    const response = await request(await app({ status: "trialing", trialEndsAt: "2026-12-10T00:00:00.000Z" })).get("/api/stores/s/billing").set("Authorization", "Bearer x");
    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.body).toMatchObject({
      status: "trialing", plan: "standard", planName: "Jellyshop", exempt: false, enforced: false, paused: false, trialEndsAt: "2026-12-10T00:00:00.000Z",
      usage: [{ kind: "products", used: 74, limit: 5000 }, { kind: "photoBytes", used: 1024, limit: 10 * 1024 ** 3 }, { kind: "files", used: 12, limit: 5000 }],
    });
  });

  it("is not shown to someone without access to the shop", async () => {
    const { default: request } = await import("supertest");
    const response = await request(await app({})).get("/api/stores/other/billing").set("Authorization", "Bearer x");
    expect(response.status).toBe(404);
  });
});

describe("which limits a shop gets", () => {
  const service = (row: Partial<StoreBillingRecord> | null) => new StoreBillingService({
    query: vi.fn(async () => ({ rows: row ? [{ storeId: "s", plan: "standard", trialEndsAt: null, currentPeriodEnd: null, cancelAtPeriodEnd: false, stripeCustomerId: null, stripeSubscriptionId: null, ...row }] : [] })),
  }, { enforced: false });

  it("trial limits while trialing without a subscription, paid limits once subscribed, none when exempt", async () => {
    expect(await service({ status: "trialing" }).planFor("s")).toBe("trial");
    expect(await service({ status: "trialing", stripeSubscriptionId: "sub_1" }).planFor("s")).toBe("standard");
    expect(await service({ status: "active" }).planFor("s")).toBe("standard");
    expect(await service({ status: "past_due" }).planFor("s")).toBe("standard");
    expect(await service({ status: "exempt" }).planFor("s")).toBe("exempt");
    expect(await service(null).planFor("s")).toBe("standard");
  });
});
