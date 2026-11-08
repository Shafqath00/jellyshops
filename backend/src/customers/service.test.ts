import { afterEach, beforeEach, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { createPGliteDatabase, seedStore, type IntegrationDatabase } from "../../test/integration/pglite.js";
import { CustomerService } from "./service.js";
import { StorefrontStarterInstallationService } from "../storefront/starter/installation-service.js";

let db: IntegrationDatabase;
let service: CustomerService;
const alice = { id: "11111111-1111-4111-8111-111111111111", email: "alice@example.test", verified: true };
const bob = { id: "22222222-2222-4222-8222-222222222222", email: "bob@example.test", verified: true };
beforeEach(async () => {
  db = await createPGliteDatabase();
  await db.exec(await readFile(new URL("../../sql/migrations/20260915120000_add_stripe_connect_commerce.sql", import.meta.url), "utf8"));
  await db.exec(await readFile(new URL("../../sql/migrations/20260920100000_add_order_item_configuration_snapshot.sql", import.meta.url), "utf8"));
  await db.exec(await readFile(new URL("../../sql/migrations/20261020140329_store_settings_checkout.sql", import.meta.url), "utf8"));
  await db.exec(await readFile(new URL("../../sql/migrations/20261020163817_jelly_signature_customer_services.sql", import.meta.url), "utf8"));
  await seedStore(db, "a", "a"); await seedStore(db, "b", "b");
  service = new CustomerService({ transaction: (work) => db.transaction(work) }, "a".repeat(32));
});
afterEach(async () => { await db?.close(); });

it("installs Signature transactionally and requires generation-checked confirmation to replace drafts", async () => {
  const installer = new StorefrontStarterInstallationService({ transaction: (work) => db.transaction(work) });
  const first = await installer.install("a", "fresh-market");
  await expect(installer.install("a", "jelly-signature")).rejects.toMatchObject({ status: 409 });
  await expect(installer.install("a", "jelly-signature", { replaceDraft: true, expectedGeneration: 0 })).rejects.toMatchObject({ status: 409 });
  const next = await installer.install("a", "jelly-signature", { replaceDraft: true, expectedGeneration: first.generation });
  expect(next.generation).toBe(first.generation + 1);
  expect((await db.query('SELECT COUNT(*)::int AS count FROM "StorefrontTemplate" WHERE "storeId"=$1 AND "handle"=$2', ["a", "default"])).rows[0].count).toBe(19);
  expect((await db.query('SELECT COUNT(*)::int AS count FROM "StorefrontTemplate" WHERE "storeId"=$1', ["a"])).rows[0].count).toBe(28);
});

it("reports reserved route conflicts without changing draft state", async () => {
  await db.query('INSERT INTO "StorePage" ("id","storeId","title","handle","content","updatedAt") VALUES ($1,$2,$3,$4,$5,NOW())', ["reserved", "a", "Old account page", "account", {}]);
  const installer = new StorefrontStarterInstallationService({ transaction: (work) => db.transaction(work) });
  await expect(installer.install("a", "jelly-signature")).rejects.toMatchObject({ status: 409 });
  expect((await db.query('SELECT COUNT(*)::int AS count FROM "StorefrontTemplate"')).rows[0].count).toBe(0);
});

it("keeps verified customer identities separate for each store and rejects unverified identities", async () => {
  const a = await service.profile("a", alice);
  const b = await service.profile("b", alice);
  expect(a.id).not.toBe(b.id);
  await expect(service.profile("a", { ...bob, verified: false })).rejects.toMatchObject({ status: 401 });
  expect((await db.query('SELECT COUNT(*)::int AS count FROM "User"')).rows[0]).toMatchObject({ count: 0 });
});

it("protects addresses with customer/store ownership and revisions", async () => {
  const address = await service.saveAddress("a", alice, undefined, { name: "Alice", line1: "1 Main St", city: "Boston", postalCode: "02108", country: "US" });
  await expect(service.saveAddress("a", bob, address.id, { ...address, revision: 0 })).rejects.toMatchObject({ status: 404 });
  await expect(service.saveAddress("b", alice, address.id, { ...address, revision: 0 })).rejects.toMatchObject({ status: 404 });
  await service.saveAddress("a", alice, address.id, { ...address, revision: 0, city: "Cambridge" });
  await expect(service.saveAddress("a", alice, address.id, { ...address, revision: 0 })).rejects.toMatchObject({ status: 409 });
});

it("deduplicates consented subscriptions and verifies store-bound unsubscribe signatures", async () => {
  await expect(service.subscribe("a", { email: "A@Example.test", consent: false, source: "footer" })).rejects.toMatchObject({ status: 422 });
  const first = await service.subscribe("a", { email: "A@Example.test", consent: true, source: "footer" });
  const retry = await service.subscribe("a", { email: "a@example.test", consent: true, source: "footer" });
  expect(retry.token).toBe(first.token);
  await expect(service.unsubscribe("b", first.token)).rejects.toMatchObject({ status: 422 });
  await expect(service.unsubscribe("a", first.token + "x")).rejects.toMatchObject({ status: 422 });
  await service.unsubscribe("a", first.token);
  expect((await db.query('SELECT "unsubscribedAt" FROM "NewsletterSubscriber"')).rows[0].unsubscribedAt).not.toBeNull();
});
