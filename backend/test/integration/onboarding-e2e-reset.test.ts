import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { createPGliteDatabase, seedStore } from "./pglite.js";
import { resetOnboardingE2eStores } from "../../scripts/lib/onboarding-e2e-reset.js";

vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const migrationDirectory = new URL("../../sql/migrations/", import.meta.url);
const onboardingSchemaMigrations = [
  "20260913160000_add_developer_membership_role.sql",
  "20260913170000_add_audit_events.sql",
  "20260913220000_add_metafields.sql",
  "20260913230000_add_metaobjects.sql",
  "20260915120000_add_stripe_connect_commerce.sql",
  "20260916100000_add_refund_idempotency_key.sql",
  "20260918000000_add_store_owner.sql",
  "20260919120000_allow_stripe_account_reconnect.sql",
  "20260920100000_add_order_item_configuration_snapshot.sql",
  "20260920100000_repair_theme_configuration_version.sql",
] as const;

const merchantUid = "11111111-1111-4111-8111-111111111111";
const otherUid = "22222222-2222-4222-8222-222222222222";
const merchantEmail = "onboarding-e2e@example.test";
const slugPrefix = "onboarding-e2e-";

describe("onboarding E2E reset", () => {
  let database: Awaited<ReturnType<typeof createPGliteDatabase>> | undefined;

  beforeAll(async () => {
    database = await createOnboardingPGliteDatabase();
  });

  afterAll(async () => {
    await database?.close();
    database = undefined;
  });

  it("pins the Store dependency graph, isolates the dedicated merchant, and refuses unsafe reset states", async () => {
    const integration = database!;
    const result = await integration.query<{ tableName: string }>(`
      WITH RECURSIVE store_dependents AS (
        SELECT c.conrelid AS relation_oid
        FROM pg_constraint c
        WHERE c.contype = 'f' AND c.confrelid = '"Store"'::regclass
        UNION
        SELECT c.conrelid
        FROM pg_constraint c
        JOIN store_dependents d ON c.confrelid = d.relation_oid
        WHERE c.contype = 'f'
      )
      SELECT DISTINCT relation.relname AS "tableName"
      FROM store_dependents d
      JOIN pg_class relation ON relation.oid = d.relation_oid
      WHERE relation.relkind = 'r'
      ORDER BY relation.relname
    `);

    expect(result.rows.map(({ tableName }) => tableName)).toEqual([
      "Article", "AuditEvent", "Blog", "CheckoutAttempt", "Collection", "CollectionProduct",
      "GlobalSection", "InventoryLevel", "InventoryReservation", "Media",
      "MetaobjectDefinition", "MetaobjectEntry", "MetafieldDefinition", "MetafieldValue", "NavigationMenu",
      "Order", "OrderItem", "Payment", "PaymentDispute", "Product", "ProductMedia", "ProductVariant",
      "PublicOrderAccessRateLimit", "Refund", "SectionPreset", "Store", "StoreDomain", "StoreMembership", "StorePage",
      "StoreSettings", "StorefrontDraft", "StorefrontPublication", "StorefrontTemplate",
      "StorefrontTemplateAssignment", "StorefrontWorkspace", "StripeConnectedAccount", "ThemeConfiguration",
    ].sort());
    const owner = await seedMerchant(integration, merchantUid, merchantEmail);
    const otherOwner = await seedMerchant(integration, otherUid, "other@example.test");
    await seedOwnedStore(integration, "dedicated-store", "onboarding-e2e-first-shop", merchantUid, owner, true);
    await seedOwnedStore(integration, "foreign-store", "onboarding-e2e-unrelated", otherUid, otherOwner, true);

    const first = await resetOnboardingE2eStores(asCommerceDatabase(integration), {
      merchantUid,
      merchantEmail,
      slugPrefix,
    });
    const second = await resetOnboardingE2eStores(asCommerceDatabase(integration), {
      merchantUid,
      merchantEmail,
      slugPrefix,
    });

    expect(first.resetStoreIds).toEqual(["dedicated-store"]);
    expect(second.resetStoreIds).toEqual([]);
    expect((await integration.query(`SELECT "id" FROM "User" WHERE "firebaseUid" = $1 AND "email" = $2`, [merchantUid, merchantEmail])).rows).toHaveLength(1);
    expect((await integration.query(`SELECT "id" FROM "Store" WHERE "id" = 'dedicated-store'`)).rows).toHaveLength(0);
    expect((await integration.query(`SELECT "id" FROM "Store" WHERE "id" = 'foreign-store'`)).rows).toHaveLength(1);
    expect((await integration.query(`SELECT "storeId" FROM "StorefrontTemplate" WHERE "storeId" = 'foreign-store'`)).rows).toHaveLength(1);

    await seedOwnedStore(integration, "published-store", "onboarding-e2e-published", merchantUid, owner, false);
    await integration.query(`INSERT INTO "StorefrontPublication" ("id", "storeId", "sourceRevision", "document") VALUES ('pub-1', 'published-store', 1, '{}'::jsonb)`);
    await integration.query(`UPDATE "Store" SET "currentPublicationId" = 'pub-1' WHERE "id" = 'published-store'`);

    await expect(resetOnboardingE2eStores(asCommerceDatabase(integration), { merchantUid, merchantEmail, slugPrefix }))
      .rejects.toMatchObject({ code: "ONBOARDING_E2E_RESET_UNSAFE_STATE" });
    expect((await integration.query(`SELECT "id" FROM "Store" WHERE "id" = 'published-store'`)).rows).toHaveLength(1);
    expect((await integration.query(`SELECT "id" FROM "StorefrontPublication" WHERE "id" = 'pub-1'`)).rows).toHaveLength(1);

    await expect(resetOnboardingE2eStores(asCommerceDatabase(integration), {
      merchantUid,
      merchantEmail: "different@example.test",
      slugPrefix,
    })).rejects.toMatchObject({ code: "ONBOARDING_E2E_RESET_IDENTITY_MISMATCH" });
    expect((await integration.query(`SELECT "id" FROM "Store" WHERE "id" = 'published-store'`)).rows).toHaveLength(1);
  });
});

async function seedMerchant(database: Awaited<ReturnType<typeof createPGliteDatabase>>, uid: string, email: string) {
  const result = await database.query<{ id: number }>(
    `INSERT INTO "User" ("name", "email", "firebaseUid", "createdAt", "updatedAt") VALUES ('E2E', $1, $2, NOW(), NOW()) RETURNING "id"`,
    [email, uid],
  );
  return result.rows[0]!.id;
}

async function seedOwnedStore(
  database: Awaited<ReturnType<typeof createPGliteDatabase>>,
  id: string,
  slug: string,
  uid: string,
  internalUserId: number,
  withStarter: boolean,
) {
  await seedStore(database, id, slug);
  await database.query(`UPDATE "Store" SET "owner_user_id" = $2 WHERE "id" = $1`, [id, uid]);
  await database.query(`INSERT INTO "StoreMembership" ("storeId", "userId", "role") VALUES ($1, $2, 'OWNER')`, [id, internalUserId]);
  if (!withStarter) return;
  await database.query(`INSERT INTO "StorefrontWorkspace" ("storeId", "generation", "updatedAt") VALUES ($1, 1, NOW())`, [id]);
  await database.query(`INSERT INTO "StorefrontTemplate" ("id", "storeId", "type", "handle", "name", "layout", "updatedAt") VALUES ($1, $2, 'HOME', 'home', 'Home', '{"sections":[]}', NOW())`, [`${id}-home`, id]);
  await database.query(`INSERT INTO "GlobalSection" ("id", "storeId", "name", "section", "updatedAt") VALUES ($1, $2, 'Header', '{"type":"header"}', NOW())`, [`${id}-header`, id]);
  await database.query(`INSERT INTO "NavigationMenu" ("id", "storeId", "name", "handle", "items", "updatedAt") VALUES ($1, $2, 'Main', 'main', '[]', NOW())`, [`${id}-main`, id]);
  await database.query(`INSERT INTO "ThemeConfiguration" ("storeId", "themeId", "settings", "updatedAt") VALUES ($1, 'fresh-market', '{}', NOW())`, [id]);
}

function asCommerceDatabase(database: Awaited<ReturnType<typeof createPGliteDatabase>>) {
  return {
    transaction: async <T,>(work: (sql: { query: (query: string, values?: unknown[]) => Promise<{ rows: any[] }> }) => Promise<T>) => {
      await database.exec("BEGIN");
      try {
        const result = await work({ query: (query, values) => database.query(query, values) });
        await database.exec("COMMIT");
        return result;
      } catch (error) {
        await database.exec("ROLLBACK");
        throw error;
      }
    },
  };
}

async function createOnboardingPGliteDatabase() {
  const integration = await createPGliteDatabase();
  try {
    for (const migration of onboardingSchemaMigrations) {
      await integration.exec(await readFile(new URL(migration, migrationDirectory), "utf8"));
    }
    return integration;
  } catch (error) {
    await integration.close();
    throw error;
  }
}
