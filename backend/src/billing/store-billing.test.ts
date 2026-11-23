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
    expect(await ended.planFor("s")).toBe("standard");
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
