import type { CommerceDatabase, SqlExecutor } from "../commerce/repository.js";
import { ApiError } from "../http/errors.js";
import { storeSlugSchema } from "../tenants/store-slug.js";
import type { StoreSummary } from "../tenants/types.js";
import {
  completeOnboardingSchema,
  type CompleteOnboardingAnswers,
  type DraftOnboardingAnswers,
  type OnboardingImageKind,
  type SaveOnboarding,
} from "./schema.js";

export type { CompleteOnboardingAnswers } from "./schema.js";

export interface OnboardingPolicies {
  termsUrl: string;
  privacyUrl: string;
  version: string;
}

function policyUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && !url.username && !url.password) return url.href;
  } catch {
    // Invalid configuration is handled as an unavailable policy.
  }
  return undefined;
}

export function readOnboardingPolicies(env: NodeJS.ProcessEnv = process.env): OnboardingPolicies | null {
  const termsUrl = policyUrl(env.JELLYSHOP_TERMS_URL);
  const privacyUrl = policyUrl(env.JELLYSHOP_PRIVACY_URL);
  const version = env.JELLYSHOP_TERMS_VERSION?.trim();
  return termsUrl && privacyUrl && version && version.length <= 100 ? { termsUrl, privacyUrl, version } : null;
}

type ProvisionStore = (
  sql: SqlExecutor,
  userId: string,
  answers: CompleteOnboardingAnswers,
  logo: Buffer | null,
  registerRollback: (cleanup: () => Promise<void>) => void,
) => Promise<StoreSummary>;

interface DraftRow {
  revision: number;
  step: SaveOnboarding["step"];
  answers: Partial<DraftOnboardingAnswers>;
  completedStoreId: string | null;
}

const emptyDraft: DraftRow = { revision: 0, step: "profile", answers: {}, completedStoreId: null };

function revisionConflict(revision: number): ApiError {
  return Object.assign(new ApiError(409, "ONBOARDING_REVISION_CONFLICT", "Setup changed in another tab. Reload to see what was saved."), { currentRevision: revision });
}

function completedConflict() {
  return new ApiError(409, "ONBOARDING_COMPLETE", "Your store is already set up. Open your dashboard to continue.");
}

async function findOwnedStore(sql: SqlExecutor, userId: string, preferredId: string | null = null): Promise<StoreSummary | null> {
  const result = await sql.query<Omit<StoreSummary, "role">>(
    `SELECT "id", "name", "slug", "currency", "country" FROM "Store"
       WHERE "owner_user_id" = $1 AND "archivedAt" IS NULL
       ORDER BY ("id" = $2) DESC NULLS LAST, "name", "id" LIMIT 1`,
    [userId, preferredId],
  );
  return result.rows[0] ? { ...result.rows[0], role: "OWNER" } : null;
}

async function lockDraft(sql: SqlExecutor, userId: string): Promise<DraftRow> {
  await sql.query(`INSERT INTO "MerchantOnboarding" ("userId") VALUES ($1) ON CONFLICT ("userId") DO NOTHING`, [userId]);
  const result = await sql.query<DraftRow>(
    `SELECT "revision", "step", "answers", "completedStoreId" FROM "MerchantOnboarding" WHERE "userId" = $1 FOR UPDATE`,
    [userId],
  );
  return result.rows[0]!;
}

async function imageBytes(sql: SqlExecutor, userId: string, kind: OnboardingImageKind): Promise<Buffer | null> {
  const result = await sql.query<{ contents: Buffer | Uint8Array }>(
    `SELECT "contents" FROM "MerchantOnboardingImage" WHERE "userId" = $1 AND "kind" = $2`,
    [userId, kind],
  );
  return result.rows[0] ? Buffer.from(result.rows[0].contents) : null;
}

async function writeProfile(sql: SqlExecutor, userId: string, fullName: string, bio: string) {
  await sql.query(
    `INSERT INTO "MerchantProfile" ("userId", "fullName", "bio") VALUES ($1, $2, $3)
       ON CONFLICT ("userId") DO UPDATE SET "fullName" = EXCLUDED."fullName", "bio" = EXCLUDED."bio"`,
    [userId, fullName, bio],
  );
}

async function readProfile(sql: SqlExecutor, userId: string) {
  const result = await sql.query<{ fullName: string; bio: string; email: string; hasImage: boolean }>(
    `SELECT COALESCE(p."fullName", u."name") AS "fullName", COALESCE(p."bio", '') AS "bio", u."email",
       EXISTS (SELECT 1 FROM "MerchantOnboardingImage" i WHERE i."userId" = $1::uuid AND i."kind" = 'profile') AS "hasImage"
       FROM "User" u LEFT JOIN "MerchantProfile" p ON p."userId" = $1::uuid WHERE u."firebaseUid" = $1::text`,
    [userId],
  );
  return result.rows[0] ?? { fullName: "", bio: "", email: "", hasImage: false };
}

export class OnboardingService {
  constructor(
    private readonly db: CommerceDatabase,
    private readonly provision: ProvisionStore,
    private readonly policies: OnboardingPolicies | null = readOnboardingPolicies(),
  ) {}

  getPolicies(): OnboardingPolicies {
    if (!this.policies) throw new ApiError(503, "ONBOARDING_POLICIES_UNAVAILABLE", "Account setup is temporarily unavailable. Try again later.");
    return this.policies;
  }

  private async hasConsent(sql: SqlExecutor, userId: string): Promise<boolean> {
    if (!this.policies) return false;
    const result = await sql.query(
      `SELECT 1 FROM "MerchantPolicyAcceptance" WHERE "userId" = $1 AND "version" = $2`,
      [userId, this.policies.version],
    );
    return result.rows.length > 0;
  }

  private async requireConsent(sql: SqlExecutor, userId: string) {
    this.getPolicies();
    if (!await this.hasConsent(sql, userId)) {
      throw new ApiError(403, "ONBOARDING_CONSENT_REQUIRED", "Accept the current JellyShop Terms of Service to set up your store.");
    }
  }

  async assertStoreCreationConsent(userId: string, hasExistingStores: boolean) {
    if (hasExistingStores) return;
    await this.db.transaction(sql => this.requireConsent(sql, userId));
  }

  async acceptConsent(userId: string, suppliedVersion: string) {
    const { version } = this.getPolicies();
    if (version !== suppliedVersion) {
      throw new ApiError(409, "ONBOARDING_POLICY_UPDATED", "The Terms of Service changed. Reload and review the current version.");
    }
    await this.db.transaction(sql => sql.query(
      `INSERT INTO "MerchantPolicyAcceptance" ("userId", "version") VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [userId, version],
    ));
  }

  private async snapshot(sql: SqlExecutor, userId: string, draft: DraftRow, fallbackName?: string) {
    const store = await findOwnedStore(sql, userId, draft.completedStoreId);
    const profile = await readProfile(sql, userId);
    const logo = await sql.query(`SELECT 1 FROM "MerchantOnboardingImage" WHERE "userId" = $1 AND "kind" = 'logo'`, [userId]);
    const fullName = fallbackName === undefined ? profile.fullName : fallbackName;
    const answers = draft.revision === 0 && fullName ? { fullName, ...draft.answers } : draft.answers;
    return {
      revision: draft.revision,
      step: draft.step,
      answers,
      store,
      consentRequired: !store && !await this.hasConsent(sql, userId),
      images: { profile: profile.hasImage, logo: logo.rows.length > 0 },
    };
  }

  get(userId: string, fallbackName?: string) {
    return this.db.transaction(async sql => {
      const draft = await sql.query<DraftRow>(
        `SELECT "revision", "step", "answers", "completedStoreId" FROM "MerchantOnboarding" WHERE "userId" = $1`,
        [userId],
      );
      return this.snapshot(sql, userId, draft.rows[0] ?? emptyDraft, fallbackName);
    });
  }

  save(userId: string, input: SaveOnboarding) {
    return this.db.transaction(async sql => {
      await this.requireConsent(sql, userId);
      const draft = await lockDraft(sql, userId);
      if (draft.completedStoreId || await findOwnedStore(sql, userId)) throw completedConflict();
      if (draft.revision !== input.revision) throw revisionConflict(draft.revision);
      const saved = await sql.query<DraftRow>(
        `UPDATE "MerchantOnboarding" SET "revision" = "revision" + 1, "step" = $2, "answers" = $3::jsonb, "updatedAt" = NOW()
           WHERE "userId" = $1 RETURNING "revision", "step", "answers", "completedStoreId"`,
        [userId, input.step, JSON.stringify(input.answers)],
      );
      return this.snapshot(sql, userId, saved.rows[0]!);
    });
  }

  async available(slug: string): Promise<boolean> {
    if (!storeSlugSchema.safeParse(slug).success) return false;
    return await this.db.transaction(async sql => {
      const result = await sql.query(`SELECT 1 FROM "Store" WHERE "slug" = $1 LIMIT 1`, [slug]);
      return result.rows.length === 0;
    });
  }

  getProfile(userId: string) {
    return this.db.transaction(sql => readProfile(sql, userId));
  }

  updateProfile(userId: string, input: { fullName: string; bio: string }) {
    return this.db.transaction(async sql => {
      await this.allowProfileChange(sql, userId);
      await writeProfile(sql, userId, input.fullName, input.bio);
      return readProfile(sql, userId);
    });
  }

  private async allowProfileChange(sql: SqlExecutor, userId: string) {
    if (!await findOwnedStore(sql, userId)) await this.requireConsent(sql, userId);
  }

  getImage(userId: string, kind: OnboardingImageKind) {
    return this.db.transaction(sql => imageBytes(sql, userId, kind));
  }

  private async allowImageChange(sql: SqlExecutor, userId: string, kind: OnboardingImageKind) {
    const draft = await lockDraft(sql, userId);
    const store = await findOwnedStore(sql, userId);
    if (kind === "logo" && (draft.completedStoreId || store)) throw completedConflict();
    if (!store) await this.requireConsent(sql, userId);
  }

  uploadImage(userId: string, kind: OnboardingImageKind, bytes: Buffer) {
    return this.db.transaction(async sql => {
      await this.allowImageChange(sql, userId, kind);
      await sql.query(
        `INSERT INTO "MerchantOnboardingImage" ("userId", "kind", "contents") VALUES ($1, $2, $3)
           ON CONFLICT ("userId", "kind") DO UPDATE SET "contents" = EXCLUDED."contents"`,
        [userId, kind, bytes],
      );
    });
  }

  removeImage(userId: string, kind: OnboardingImageKind) {
    return this.db.transaction(async sql => {
      await this.allowImageChange(sql, userId, kind);
      await sql.query(`DELETE FROM "MerchantOnboardingImage" WHERE "userId" = $1 AND "kind" = $2`, [userId, kind]);
    });
  }

  async complete(userId: string, revision: number): Promise<StoreSummary> {
    const rollback: (() => Promise<void>)[] = [];
    let provisioned: StoreSummary | undefined;
    try {
      return await this.db.transaction(async sql => {
        const draft = await lockDraft(sql, userId);
        const store = await findOwnedStore(sql, userId, draft.completedStoreId);
        if (store) return store;
        if (draft.completedStoreId) throw completedConflict();
        await this.requireConsent(sql, userId);
        if (draft.revision !== revision) throw revisionConflict(draft.revision);
        const result = completeOnboardingSchema.safeParse(draft.answers);
        if (!result.success) {
          throw new ApiError(422, "ONBOARDING_INCOMPLETE", "Check your setup details before creating your store.", result.error.issues.map(issue => ({
            path: issue.path.join("."),
            message: issue.message,
          })));
        }
        const logo = await imageBytes(sql, userId, "logo");
        const created = await this.provision(sql, userId, result.data, logo, cleanup => rollback.push(cleanup));
        await writeProfile(sql, userId, result.data.fullName, result.data.bio ?? "");
        await sql.query(
          `UPDATE "MerchantOnboarding" SET "completedStoreId" = $2, "updatedAt" = NOW() WHERE "userId" = $1`,
          [userId, created.id],
        );
        await sql.query(`DELETE FROM "MerchantOnboardingImage" WHERE "userId" = $1 AND "kind" = 'logo'`, [userId]);
        provisioned = created;
        return created;
      });
    } catch (error) {
      const candidate = provisioned;
      if (candidate) {
        // A connection can fail after Postgres commits but before it replies. Recheck the
        // completion marker on a new connection before removing any attached media.
        const outcome = await this.db.transaction(async sql => {
          const draft = await lockDraft(sql, userId);
          return draft.completedStoreId === candidate.id;
        }).catch(() => null);
        if (outcome === true) return candidate;
        if (outcome === false) await Promise.allSettled(rollback.map(async cleanup => cleanup()));
      } else {
        await Promise.allSettled(rollback.map(async cleanup => cleanup()));
      }
      const violation = error as { code?: string; constraint?: string };
      if (violation.code === "23505" && violation.constraint === "Store_slug_key") {
        throw new ApiError(409, "STORE_SLUG_TAKEN", "That store address is already in use. Choose another address.");
      }
      throw error;
    }
  }
}
