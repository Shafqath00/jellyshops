import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import type { SqlExecutor } from "../../src/commerce/repository.js";
import { emailClaimKey } from "../../src/billing/trial-claims.js";
import { createOwnedStore } from "../../src/tenants/postgres-repository.js";
import { createPGliteDatabase } from "./pglite.js";

const migration = (name: string) => readFile(new URL(`../../sql/migrations/${name}`, import.meta.url), "utf8");

async function setup() {
  const database = await createPGliteDatabase();
  for (const name of ["20260918000000_add_store_owner.sql", "20260915120000_add_stripe_connect_commerce.sql", "20261020140329_store_settings_checkout.sql", "20261020163817_jelly_signature_customer_services.sql", "20261114000000_merchant_onboarding.sql"]) {
    await database.exec(await migration(name));
  }
  const addUser = (uid: string, email: string) =>
    database.query(`INSERT INTO "User" ("name", "email", "firebaseUid", "updatedAt") VALUES ('Owner', $1, $2, NOW())`, [email, uid]);
  const createStore = (uid: string, slug: string) =>
    database.transaction((tx) => createOwnedStore({ query: (text, values) => tx.query(text, values) } as SqlExecutor, uid, { name: slug, slug, currency: "GBP", country: "GB" }));
  const billing = async (storeId: string) =>
    (await database.query<{ status: string; trialEndsAt: Date | null }>(`SELECT "status", "trialEndsAt" FROM "StoreBilling" WHERE "storeId" = $1`, [storeId])).rows[0];
  return { database, addUser, createStore, billing };
}

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const C = "00000000-0000-4000-8000-00000000000c";

describe("one free trial per owner and email", () => {
  it("gives the first shop a trial and the owner's next shop none", async () => {
    const { addUser, createStore, billing } = await setup();
    await addUser(A, "sam@gmail.com");
    const first = await createStore(A, "first-shop");
    const second = await createStore(A, "second-shop");
    expect(await billing(first.id)).toMatchObject({ status: "trialing" });
    expect((await billing(first.id))?.trialEndsAt).not.toBeNull();
    expect(await billing(second.id)).toMatchObject({ status: "expired", trialEndsAt: null });
  });

  it("refuses a trial to another account with the same Gmail written differently", async () => {
    const { addUser, createStore, billing } = await setup();
    await addUser(A, "sam@gmail.com");
    await addUser(B, "S.am+again@googlemail.com");
    await addUser(C, "someone@example.com");
    await createStore(A, "first-shop");
    expect(await billing((await createStore(B, "other-shop")).id)).toMatchObject({ status: "expired" });
    expect(await billing((await createStore(C, "third-shop")).id)).toMatchObject({ status: "trialing" });
  });

  it("keeps the claim after the shop is deleted", async () => {
    const { database, addUser, createStore, billing } = await setup();
    await addUser(A, "sam@example.com");
    const first = await createStore(A, "first-shop");
    for (const table of ["StoreMembership", "StoreSettings", "StorefrontWorkspace", "StoreBilling"]) await database.query(`DELETE FROM "${table}" WHERE "storeId" = $1`, [first.id]);
    await database.query(`DELETE FROM "Store" WHERE "id" = $1`, [first.id]);
    expect((await database.query(`SELECT * FROM "TrialClaim"`)).rows).toHaveLength(2);
    expect(await billing((await createStore(A, "again-shop")).id)).toMatchObject({ status: "expired" });
  });

  it("works as before when the table is not there yet", async () => {
    const { database, addUser, createStore, billing } = await setup();
    await database.exec(`DROP TABLE "TrialClaim"`);
    await addUser(A, "sam@example.com");
    await createStore(A, "first-shop");
    expect(await billing((await createStore(A, "second-shop")).id)).toMatchObject({ status: "trialing" });
  });

  it("the migration's backfill hashes emails the same way as the app", async () => {
    const { database, addUser, createStore } = await setup();
    await addUser(A, "S.a.m+old@GoogleMail.com");
    const store = await createStore(A, "old-shop");
    await database.exec(`DROP TABLE "TrialClaim"`);
    await database.exec(await migration("20261125010000_trial_claims.sql"));
    const rows = (await database.query<{ kind: string; value: string; storeId: string }>(`SELECT "kind", "value", "storeId" FROM "TrialClaim" ORDER BY "kind"`)).rows;
    expect(rows).toEqual([
      { kind: "email", value: emailClaimKey("sam@gmail.com"), storeId: store.id },
      { kind: "user", value: expect.any(String), storeId: store.id },
    ]);
  });
});
