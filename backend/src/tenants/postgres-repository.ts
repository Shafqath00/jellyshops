import pg from "pg";
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
    // Upsert user by Supabase UID
    const upsertResult = await this.pool.query<{ id: number }>(
      `INSERT INTO "User" ("name", "email", "firebaseUid", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT ("firebaseUid") DO UPDATE
         SET "name" = EXCLUDED."name",
             "updatedAt" = NOW()
       RETURNING "id"`,
      [identity.name, identity.email, identity.uid],
    );

    const internalId = upsertResult.rows[0]?.id;
    if (!internalId) {
      throw new Error("Failed to resolve merchant account");
    }

    const stores = await this._listOwnedStores(identity.uid);
    return { id: identity.uid, stores };
  }

  async listStores(userId: string): Promise<StoreSummary[]> {
    return this._listOwnedStores(userId);
  }

  async createStore(
    userId: string,
    input: CreateStoreInput,
  ): Promise<StoreSummary> {
    // Look up internal integer id
    const userResult = await this.pool.query<{ id: number }>(
      `SELECT "id" FROM "User" WHERE "firebaseUid" = $1 LIMIT 1`,
      [userId],
    );
    const internalId = userResult.rows[0]?.id;
    if (!internalId) {
      throw new Error("User not found");
    }

    const storeId = `store-${input.slug}-${Date.now()}`;

    await this.pool.query(
      `INSERT INTO "Store" ("id", "name", "slug", "currency", "country", "owner_user_id", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [storeId, input.name, input.slug, input.currency, input.country, userId],
    );

    await this.pool.query(
      `INSERT INTO "StoreMembership" ("storeId", "userId", "role", "createdAt")
       VALUES ($1, $2, 'OWNER', NOW())`,
      [storeId, internalId],
    );

    return {
      id: storeId,
      name: input.name,
      slug: input.slug,
      currency: input.currency,
      country: input.country,
      role: "OWNER",
    };
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
