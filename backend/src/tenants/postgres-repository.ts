import pg from "pg";
import { randomUUID } from "node:crypto";
import type {
  CreateStoreInput,
  MerchantAccount,
  StoreSummary,
  VerifiedMerchantIdentity,
} from "./types.js";
import type { TenantRepository } from "./repository.js";

const { Pool } = pg;

/**
 * PostgreSQL implementation of TenantRepository.
 *
 * Uses Supabase Auth UUIDs (strings) as the userId/merchantId.
 * The authenticated Supabase user is the single owner of a store.  The
 * legacy StoreMembership row is still written for compatibility with older
 * schema consumers, but it is not used to authorize a request.
 */
export class PostgresTenantRepository implements TenantRepository {
  constructor(private readonly pool: pg.Pool) {}

  /**
   * Resolves or creates a merchant record based on a verified Supabase identity.
   * On first login, inserts the user into the "User" table.
   * Returns the user's id (Supabase UUID) and their stores.
   */
  async resolveMerchant(
    identity: VerifiedMerchantIdentity,
  ): Promise<MerchantAccount> {
    // One round trip on every signed-in request: keep the user row (written only when it is new or
    // the name changed) and list the stores they own. The store list does not read the user row.
    const result = await this.pool.query<{ id: string; name: string; slug: string; currency: string; country: string }>(
      `WITH upsert AS (
         INSERT INTO "User" ("name", "email", "firebaseUid", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, NOW(), NOW())
         ON CONFLICT ("firebaseUid") DO UPDATE SET "name" = EXCLUDED."name", "updatedAt" = NOW()
           WHERE "User"."name" IS DISTINCT FROM EXCLUDED."name"
         RETURNING "id")
       SELECT s."id", s."name", s."slug", s."currency", s."country"
       FROM "Store" s
       WHERE s."owner_user_id" = $3::uuid AND s."archivedAt" IS NULL
       ORDER BY s."name"`,
      [identity.name, identity.email, identity.uid],
    );
    const stores = result.rows.map((row) => ({ id: row.id, name: row.name, slug: row.slug, currency: row.currency, country: row.country, role: "OWNER" as const }));
    return { id: identity.uid, stores };
  }

  async listStores(userId: string): Promise<StoreSummary[]> {
    return this._listOwnedStores(userId);
  }

  async createStore(
    userId: string,
    input: CreateStoreInput,
  ): Promise<StoreSummary> {
    const client = await this.pool.connect();
    try {
    await client.query("BEGIN");
    // Look up internal integer id
    const userResult = await client.query<{ id: number }>(
      `SELECT "id" FROM "User" WHERE "firebaseUid" = $1 LIMIT 1`,
      [userId],
    );
    const internalId = userResult.rows[0]?.id;
    if (!internalId) {
      throw new Error("User not found");
    }

    const storeId = `store-${randomUUID()}`;

    await client.query(
      `INSERT INTO "Store" ("id", "name", "slug", "currency", "country", "owner_user_id", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [storeId, input.name, input.slug, input.currency, input.country, userId],
    );

    await client.query(
      `INSERT INTO "StoreMembership" ("storeId", "userId", "role", "createdAt")
       VALUES ($1, $2, 'OWNER', NOW())`,
      [storeId, internalId],
    );

    await client.query(`INSERT INTO "StoreSettings" ("storeId") VALUES ($1)`, [storeId]);
    await client.query(`INSERT INTO "StorefrontWorkspace" ("storeId", "generation", "updatedAt") VALUES ($1, 0, NOW())`, [storeId]);
    await client.query("COMMIT");
    return {
      id: storeId,
      name: input.name,
      slug: input.slug,
      currency: input.currency,
      country: input.country,
      role: "OWNER",
    };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  }

  private async _listOwnedStores(
    userId: string,
  ): Promise<StoreSummary[]> {
    const result = await this.pool.query<{
      id: string;
      name: string;
      slug: string;
      currency: string;
      country: string;
    }>(
      `SELECT s."id", s."name", s."slug", s."currency", s."country"
       FROM "Store" s
       WHERE s."owner_user_id" = $1::uuid
         AND s."archivedAt" IS NULL
       ORDER BY s."name"`,
      [userId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      currency: row.currency,
      country: row.country,
      role: "OWNER",
    }));
  }
}
