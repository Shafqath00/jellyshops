import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import type { SqlExecutor } from "../../src/commerce/repository.js";
import { BillingJobs, type BillingMessage } from "../../src/billing/billing-jobs.js";
import { listRetention } from "../../src/billing/retention.js";
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
  // The trial ended on 1 January.
  const closedAt = new Date("2027-01-01T09:00:00Z");
  await database.query(`UPDATE "StoreBilling" SET "status" = 'expired', "trialEndsAt" = $2 WHERE "storeId" = $1`, [store.id, closedAt]);
  return { database, store, sql, closedAt };
}

const jobs = (sql: Sql, at: () => Date, sent: BillingMessage[], enforced = true) =>
  new BillingJobs(sql, { async send(message) { sent.push(message); } }, { adminBaseUrl: "https://jellyshop.io", enforced, now: at });

describe("keeping closed shops for 90 days", () => {
  it("warns once 14 days before the deletion date, then lists the shop as due on that date", async () => {
    const { store, sql, closedAt } = await setup();
    const sent: BillingMessage[] = [];
    let now = new Date(closedAt.getTime() + 75 * DAY);
    const job = jobs(sql, () => now, sent);

    await job.run();
    expect(sent).toHaveLength(0);
    expect(await listRetention(sql, now)).toEqual([]);

    now = new Date(closedAt.getTime() + 76 * DAY);
    await job.run();
    await job.run();
    expect(sent.map((message) => message.subject)).toEqual(["We'll delete Sleep Well on 1 April 2027 unless you choose a plan"]);
    expect(sent[0]!.text).toContain("closed to shoppers since 1 January 2027");

    const [listed] = await listRetention(sql, now);
    expect(listed).toMatchObject({ storeId: store.id, slug: "sleep-well", ownerEmail: "owner@example.test", status: "expired", due: false });
    expect(listed!.deleteFrom).toBe(new Date(closedAt.getTime() + 90 * DAY).toISOString());

    now = new Date(closedAt.getTime() + 90 * DAY + 60_000);
    expect((await listRetention(sql, now))[0]).toMatchObject({ due: true });
  });

  it("gives 14 days' notice even when the warning goes out late, and never lists a shop as due without one", async () => {
    const { sql, closedAt } = await setup();
    const late = new Date(closedAt.getTime() + 200 * DAY);
    expect((await listRetention(sql, late))[0]).toMatchObject({ warnedAt: null, deleteFrom: null, due: false });

    const sent: BillingMessage[] = [];
    await jobs(sql, () => late, sent).run();
    const [listed] = await listRetention(sql, late);
    expect(new Date(listed!.deleteFrom!).getTime()).toBeGreaterThanOrEqual(late.getTime() + 14 * DAY);
    expect(listed!.due).toBe(false);
  });

  it("sends no warning while billing isn't enforced (the shop isn't really closed)", async () => {
    const { sql, closedAt } = await setup();
    const sent: BillingMessage[] = [];
    await jobs(sql, () => new Date(closedAt.getTime() + 80 * DAY), sent, false).run();
    expect(sent).toHaveLength(0);
  });

  it("drops off the list as soon as the shop pays again", async () => {
    const { database, store, sql, closedAt } = await setup();
    const now = new Date(closedAt.getTime() + 95 * DAY);
    await jobs(sql, () => now, []).run();
    expect(await listRetention(sql, now)).toHaveLength(1);
    await database.query(`UPDATE "StoreBilling" SET "status" = 'active', "stripeSubscriptionId" = 'sub_1' WHERE "storeId" = $1`, [store.id]);
    expect(await listRetention(sql, now)).toEqual([]);
  });
});
