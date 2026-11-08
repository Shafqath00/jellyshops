import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { createPGliteDatabase, seedStore, type IntegrationDatabase } from "../../test/integration/pglite.js";
import { PostgresTenantRepository } from "./postgres-repository.js";

describe("resolveMerchant", () => {
  let database: IntegrationDatabase;
  beforeEach(async () => {
    database = await createPGliteDatabase();
    await database.exec(await readFile(new URL("../../sql/migrations/20260918000000_add_store_owner.sql", import.meta.url), "utf8"));
  });
  afterEach(async () => { await database.close(); });

  it("creates the user once, writes again only when the name changes, and lists owned stores in one query", async () => {
    const uid = "11111111-1111-4111-8111-111111111111";
    const repository = new PostgresTenantRepository(database as never);
    const first = await repository.resolveMerchant({ uid, email: "m@example.com", name: "Mia" });
    expect(first.stores).toEqual([]);
    await seedStore(database, "store-a", "store-a");
    await database.query(`UPDATE "Store" SET "owner_user_id" = $1::uuid WHERE "id" = 'store-a'`, [uid]);
    const before = (await database.query<{ updatedAt: Date }>(`SELECT "updatedAt" FROM "User" WHERE "firebaseUid" = $1`, [uid])).rows[0].updatedAt;
    const second = await repository.resolveMerchant({ uid, email: "m@example.com", name: "Mia" });
    expect(second.stores.map((store) => [store.id, store.role])).toEqual([["store-a", "OWNER"]]);
    expect((await database.query<{ updatedAt: Date }>(`SELECT "updatedAt" FROM "User" WHERE "firebaseUid" = $1`, [uid])).rows[0].updatedAt).toEqual(before);
    await repository.resolveMerchant({ uid, email: "m@example.com", name: "Mia Rao" });
    expect((await database.query<{ name: string; count: number }>(`SELECT "name", (SELECT COUNT(*)::int FROM "User") AS count FROM "User" WHERE "firebaseUid" = $1`, [uid])).rows[0]).toEqual({ name: "Mia Rao", count: 1 });
  });
});
