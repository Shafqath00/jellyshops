export const ONBOARDING_E2E_STORE_SLUG_PREFIX = "onboarding-e2e-";

export interface OnboardingResetSql {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    values?: unknown[],
  ): Promise<{ rows: Row[] }>;
}

export interface OnboardingResetDatabase {
  transaction<T>(work: (sql: OnboardingResetSql) => Promise<T>): Promise<T>;
}

export interface OnboardingResetIdentity {
  merchantUid: string;
  merchantEmail: string;
  slugPrefix?: string;
}

export interface OnboardingResetResult {
  resetStoreIds: string[];
}

export class OnboardingResetError extends Error {
  constructor(
    readonly code: "ONBOARDING_E2E_RESET_IDENTITY_MISMATCH" | "ONBOARDING_E2E_RESET_UNSAFE_STATE",
    message: string,
  ) {
    super(message);
    this.name = "OnboardingResetError";
  }
}

/**
 * Tables intentionally removed by the test-only onboarding reset. This is
 * deliberately narrower than the complete Store dependency graph: test setup
 * creates only a store, its membership, and an installed starter workspace.
 */
const RESETTABLE_TABLES_IN_DELETE_ORDER = [
  "StorefrontTemplateAssignment",
  "ThemeConfiguration",
  "NavigationMenu",
  "SectionPreset",
  "GlobalSection",
  "StorefrontTemplate",
  "StorefrontDraft",
  "StorefrontWorkspace",
  "StoreDomain",
  "StoreSettings",
  "StoreMembership",
] as const;

/** All migrated FK descendants must be reviewed before the reset may run. */
export const ONBOARDING_RESET_SCHEMA_DEPENDENTS = [
  "Article", "AuditEvent", "Blog", "CheckoutAttempt", "Collection", "CollectionProduct",
  "GlobalSection", "InventoryLevel", "InventoryReservation", "Media", "MetaobjectDefinition",
  "MetaobjectEntry", "MetafieldDefinition", "MetafieldValue", "NavigationMenu", "Order", "OrderItem",
  "Payment", "PaymentDispute", "Product", "ProductMedia", "ProductVariant", "PublicOrderAccessRateLimit",
  "Refund", "SectionPreset", "Store", "StoreDomain", "StoreMembership", "StorePage", "StoreSettings",
  "StorefrontDraft", "StorefrontPublication", "StorefrontTemplate", "StorefrontTemplateAssignment",
  "StorefrontWorkspace", "StripeConnectedAccount", "ThemeConfiguration",
] as const;

const NON_RESETTABLE_TABLES = [
  "Article", "AuditEvent", "Blog", "CheckoutAttempt", "Collection", "CollectionProduct", "InventoryLevel",
  "InventoryReservation", "Media", "MetaobjectDefinition", "MetaobjectEntry", "MetafieldDefinition",
  "MetafieldValue", "Order", "OrderItem", "Payment", "PaymentDispute", "Product", "ProductMedia",
  "ProductVariant", "PublicOrderAccessRateLimit", "Refund", "StorefrontPublication", "StorePage",
  "StripeConnectedAccount",
] as const;

export async function resetOnboardingE2eStores(
  database: OnboardingResetDatabase,
  identity: OnboardingResetIdentity,
): Promise<OnboardingResetResult> {
  const slugPrefix = identity.slugPrefix ?? ONBOARDING_E2E_STORE_SLUG_PREFIX;
  if (slugPrefix !== ONBOARDING_E2E_STORE_SLUG_PREFIX) {
    throw new OnboardingResetError("ONBOARDING_E2E_RESET_IDENTITY_MISMATCH", "The onboarding store prefix is not the reserved test prefix.");
  }

  return database.transaction(async (sql) => {
    await assertReviewedStoreDependencyGraph(sql);

    const users = await sql.query<{ id: number }>(
      `SELECT "id" FROM "User" WHERE "firebaseUid" = $1 AND lower("email") = lower($2) FOR UPDATE`,
      [identity.merchantUid, identity.merchantEmail],
    );
    if (users.rows.length !== 1) {
      throw new OnboardingResetError("ONBOARDING_E2E_RESET_IDENTITY_MISMATCH", "The verified onboarding merchant does not match exactly one internal user.");
    }
    const internalUserId = Number(users.rows[0]!.id);

    const ownedStores = await sql.query<{ id: string; slug: string }>(
      `SELECT "id", "slug" FROM "Store"
       WHERE "owner_user_id" = $1::uuid AND left("slug", length($2)) = $2
       ORDER BY "id" FOR UPDATE`,
      [identity.merchantUid, slugPrefix],
    );
    const storeIds = ownedStores.rows.map(({ id }) => id);
    if (storeIds.length === 0) return { resetStoreIds: [] };

    const ownerMemberships = await sql.query<{ storeId: string }>(
      `SELECT "storeId" FROM "StoreMembership"
       WHERE "storeId" = ANY($1::text[]) AND "userId" = $2 AND "role" = 'OWNER'`,
      [storeIds, internalUserId],
    );
    if (ownerMemberships.rows.length !== storeIds.length) {
      throw new OnboardingResetError("ONBOARDING_E2E_RESET_IDENTITY_MISMATCH", "A matching test store is missing its expected owner membership.");
    }

    for (const table of NON_RESETTABLE_TABLES) {
      const result = await sql.query<{ count: number }>(
        `SELECT count(*)::int AS "count" FROM "${table}" WHERE "storeId" = ANY($1::text[])`,
        [storeIds],
      );
      if (Number(result.rows[0]?.count ?? 0) > 0) {
        throw new OnboardingResetError("ONBOARDING_E2E_RESET_UNSAFE_STATE", `Refusing to reset onboarding stores with rows in ${table}.`);
      }
    }

    for (const table of RESETTABLE_TABLES_IN_DELETE_ORDER) {
      await sql.query(`DELETE FROM "${table}" WHERE "storeId" = ANY($1::text[])`, [storeIds]);
    }
    await sql.query(
      `DELETE FROM "Store" WHERE "id" = ANY($1::text[]) AND "owner_user_id" = $2::uuid`,
      [storeIds, identity.merchantUid],
    );

    return { resetStoreIds: storeIds };
  });
}

async function assertReviewedStoreDependencyGraph(sql: OnboardingResetSql): Promise<void> {
  const result = await sql.query<{ tableName: string }>(`
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
  const actual = result.rows.map(({ tableName }) => tableName);
  const expected = [...ONBOARDING_RESET_SCHEMA_DEPENDENTS].sort();
  if (actual.length !== expected.length || actual.some((table, index) => table !== expected[index])) {
    throw new OnboardingResetError("ONBOARDING_E2E_RESET_UNSAFE_STATE", "The Store foreign-key dependency graph changed; review the reset allowlist before running it.");
  }
}
