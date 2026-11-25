import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import type { SqlExecutor } from "../../src/commerce/repository.js";
import { BillingJobs, type BillingMessage } from "../../src/billing/billing-jobs.js";
import { StoreBillingService } from "../../src/billing/store-billing.js";
import { saveSubscriptionChange } from "../../src/billing/stripe-billing.js";
import { createOwnedStore } from "../../src/tenants/postgres-repository.js";
import { createPGliteDatabase } from "./pglite.js";

const migration = (name: string) => readFile(new URL(`../../sql/migrations/${name}`, import.meta.url), "utf8");
const DAY = 24 * 60 * 60 * 1000;
type Sql = { query(text: string, values?: unknown[]): Promise<{ rows: unknown[] }> };

async function setup() {
  const database = await createPGliteDatabase();
  for (const name of ["20260918000000_add_store_owner.sql", "20260915120000_add_stripe_connect_commerce.sql", "20261020140329_store_settings_checkout.sql", "20261020163817_jelly_signature_customer_services.sql", "20261114000000_merchant_onboarding.sql"]) {
    await database.exec(await migration(name));
  }
  await database.query(`INSERT INTO "User" ("name", "email", "firebaseUid", "updatedAt") VALUES ('Owner', 'owner@example.test', '00000000-0000-4000-8000-000000000001', NOW())`);
  const store = await database.transaction((tx) => createOwnedStore({ query: (text, values) => tx.query(text, values) } as SqlExecutor, "00000000-0000-4000-8000-000000000001", { name: "Sleep Well", slug: "sleep-well", currency: "GBP", country: "GB" }));
  const sql: Sql = { query: (text, values) => database.query(text, values) as never };
  const created = (await database.query<{ trialEndsAt: Date }>(`SELECT "trialEndsAt" FROM "StoreBilling" WHERE "storeId" = $1`, [store.id])).rows[0]!.trialEndsAt;
  const trialStart = new Date(new Date(created).getTime() - 14 * DAY);
  return { database, store, sql, trialStart };
}

function jobsAt(sql: Sql, at: () => Date, sent: BillingMessage[], options: { enforced?: boolean; fail?: boolean } = {}) {
  return new BillingJobs(sql, {
    async send(message) { if (options.fail) throw new Error("smtp down"); sent.push(message); },
  }, { adminBaseUrl: "https://jellyshop.io", enforced: options.enforced ?? false, now: at });
}

describe("billing job on the real schema", () => {
  it("reminds on day 10 and day 13 once each, then expires the trial and says so once", async () => {
    const { database, store, sql, trialStart } = await setup();
    const sent: BillingMessage[] = [];
    let now = new Date(trialStart.getTime() + 9 * DAY);
    const jobs = jobsAt(sql, () => now, sent);

    expect((await jobs.run()).sent).toBe(0);
    now = new Date(trialStart.getTime() + 10 * DAY + 60_000);
    expect((await jobs.run()).sent).toBe(1);
    expect((await jobs.run()).sent).toBe(0); // never twice
    expect(sent[0]).toMatchObject({ to: "owner@example.test", subject: "4 days left in your Sleep Well trial" });
    expect(sent[0]!.text).toContain("https://jellyshop.io/admin/s/sleep-well/settings/billing");
    expect(sent[0]!.text).toContain("£15 a month (or £150 a year)");

    now = new Date(trialStart.getTime() + 13 * DAY + 60_000);
    await jobs.run();
    expect(sent.at(-1)!.subject).toBe("1 day left in your Sleep Well trial");

    now = new Date(trialStart.getTime() + 14 * DAY + 60_000);
    expect(await jobs.run()).toMatchObject({ expired: 1, sent: 1 });
    expect(sent.at(-1)!.subject).toBe("Your Sleep Well trial has ended");
    const row = (await database.query<{ status: string }>(`SELECT "status" FROM "StoreBilling" WHERE "storeId" = $1`, [store.id])).rows[0];
    expect(row?.status).toBe("expired");
    expect((await jobs.run()).sent).toBe(0);
    expect(sent).toHaveLength(3);

    // An expired shop counts as closed (once enforced) and keeps the trial limits.
    const billing = new StoreBillingService(sql, { enforced: true, now: () => now });
    expect(await billing.state(store.id)).toMatchObject({ status: "expired", pauseReason: "trial-ended", paused: true });
    expect(await billing.planFor(store.id)).toBe("trial");
  });

  it("sends only the latest trial reminder when the job runs late", async () => {
    const { sql, trialStart } = await setup();
    const sent: BillingMessage[] = [];
    await jobsAt(sql, () => new Date(trialStart.getTime() + 13 * DAY + 60_000), sent).run();
    expect(sent.map((message) => message.subject)).toEqual(["1 day left in your Sleep Well trial"]);
  });

  it("never expires a trial that has a subscription, and gives the claim back when sending fails", async () => {
    const { database, store, sql, trialStart } = await setup();
    await database.query(`UPDATE "StoreBilling" SET "stripeSubscriptionId" = 'sub_1' WHERE "storeId" = $1`, [store.id]);
    expect((await jobsAt(sql, () => new Date(trialStart.getTime() + 20 * DAY), []).run()).expired).toBe(0);

    await database.query(`UPDATE "StoreBilling" SET "stripeSubscriptionId" = NULL WHERE "storeId" = $1`, [store.id]);
    const day10 = () => new Date(trialStart.getTime() + 10 * DAY + 60_000);
    expect(await jobsAt(sql, day10, [], { fail: true }).run()).toMatchObject({ sent: 0, failed: 1 });
    expect((await database.query(`SELECT * FROM "BillingReminder"`)).rows).toHaveLength(0);
    const sent: BillingMessage[] = [];
    expect((await jobsAt(sql, day10, sent).run()).sent).toBe(1);
  });

  it("starts a 7-day grace period on a failed payment, emails once, then closes the shop when enforced", async () => {
    const { database, store, sql } = await setup();
    const failedAt = new Date("2026-12-20T10:00:00Z");
    const change = { storeId: store.id, status: "past_due" as const, trialEndsAt: null, currentPeriodEnd: new Date("2027-01-20T10:00:00Z"), cancelAtPeriodEnd: false, stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_1" };
    await saveSubscriptionChange(sql, change, { grace: true, now: failedAt });
    // Stripe retries a few days later: the grace end does not move.
    await saveSubscriptionChange(sql, change, { grace: true, now: new Date(failedAt.getTime() + 3 * DAY) });
    const graceEndsAt = new Date((await database.query<{ graceEndsAt: Date }>(`SELECT "graceEndsAt" FROM "StoreBilling" WHERE "storeId" = $1`, [store.id])).rows[0]!.graceEndsAt);
    expect(graceEndsAt.getTime()).toBe(failedAt.getTime() + 7 * DAY);

    const sent: BillingMessage[] = [];
    let now = new Date(failedAt.getTime() + DAY);
    const jobs = jobsAt(sql, () => now, sent, { enforced: true });
    await jobs.run();
    await jobs.run();
    expect(sent.map((message) => message.subject)).toEqual(["Payment for Sleep Well didn't go through"]);
    expect(sent[0]!.text).toContain("27 December 2026");

    const billing = new StoreBillingService(sql, { enforced: true, now: () => now });
    expect(await billing.state(store.id)).toMatchObject({ status: "past_due", paused: false, graceEndsAt: graceEndsAt.toISOString() });
    now = new Date(graceEndsAt.getTime() + 60_000);
    expect(await billing.state(store.id)).toMatchObject({ pauseReason: "payment-stopped", paused: true });
    await jobs.run();
    expect(sent.at(-1)!.subject).toBe("Sleep Well is closed until payment goes through");

    // Paid at last: grace cleared, shop open.
    await saveSubscriptionChange(sql, { ...change, status: "active" }, { grace: true, now });
    expect(await billing.state(store.id)).toMatchObject({ status: "active", paused: false, graceEndsAt: null });
  });

  it("does nothing before the migration runs", async () => {
    const { database, sql } = await setup();
    await database.exec(`DROP TABLE "BillingReminder"`);
    expect(await jobsAt(sql, () => new Date(), []).run()).toMatchObject({ ready: false, expired: 0 });
  });
});
