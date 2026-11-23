import { randomUUID } from "node:crypto";
import { Router, type RequestHandler } from "express";
import { requireMerchant } from "../auth/middleware.js";
import type { AuthProvider } from "../auth/types.js";
import type { SqlExecutor } from "../commerce/repository.js";
import { ApiError } from "../http/errors.js";

/**
 * The platform super-admin (platform.jellyshop.io): `/api/platform/*`. Only people listed in "PlatformAdmin" (added by
 * hand in SQL, never through the app), signed in with a second step (an authenticator app, Supabase "aal2") and
 * within the last 12 hours. Every action is written to "PlatformAuditEvent".
 * Design: docs/plans/2026-11-22-subdomain-tenancy-plan.md §6 and step 9. Migration 20261122050000.
 */
export const PLATFORM_SIGN_IN_MAX_AGE_MS = 12 * 60 * 60 * 1000;

type Database = { transaction<T>(work: (sql: SqlExecutor) => Promise<T>): Promise<T> };
export type PlatformAdmin = { userId: number; role: "OWNER" | "SUPPORT"; email: string };

/**
 * What the sign-in token says about how the person signed in: Supabase's assurance level ("aal2" after the
 * authenticator step) and when they last signed in with a first step (password, email link, …). Only read after the
 * token was verified, so the claims can be trusted.
 */
export function readSessionClaims(token: string): { aal: string | null; signedInAt: number | null } {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8")) as {
      aal?: unknown; amr?: Array<{ method?: unknown; timestamp?: unknown }>;
    };
    const firstSteps = (Array.isArray(payload.amr) ? payload.amr : [])
      .filter((entry) => typeof entry?.timestamp === "number" && entry.method !== "totp" && entry.method !== "mfa/totp")
      .map((entry) => (entry.timestamp as number) * 1000);
    return { aal: typeof payload.aal === "string" ? payload.aal : null, signedInAt: firstSteps.length ? Math.max(...firstSteps) : null };
  } catch {
    return { aal: null, signedInAt: null };
  }
}

async function findPlatformAdmin(sql: SqlExecutor, authUserId: string): Promise<PlatformAdmin | null> {
  try {
    const result = await sql.query<{ id: number; role: "OWNER" | "SUPPORT"; email: string }>(
      `SELECT u."id", p."role", u."email" FROM "PlatformAdmin" p JOIN "User" u ON u."id" = p."userId" WHERE u."firebaseUid" = $1 LIMIT 1`,
      [authUserId],
    );
    const row = result.rows[0];
    return row ? { userId: row.id, role: row.role, email: row.email } : null;
  } catch (error) {
    // Before the migration there are no platform admins.
    if ((error as { code?: string }).code === "42P01") return null;
    throw error;
  }
}

/** Signed in, listed as a platform admin, second step done, and signed in within 12 hours. */
export function requirePlatformAdmin(authProvider: AuthProvider, db: Database, now: () => number = Date.now): RequestHandler[] {
  return [requireMerchant(authProvider), async (request, response, next) => {
    try {
      const admin = await db.transaction((sql) => findPlatformAdmin(sql, request.merchant!.userId));
      if (!admin) throw new ApiError(403, "PLATFORM_FORBIDDEN", "This page isn't available to your account.");
      const token = (request.header("authorization") ?? "").replace(/^Bearer\s+/i, "");
      const claims = readSessionClaims(token);
      if (claims.aal !== "aal2") throw new ApiError(403, "PLATFORM_MFA_REQUIRED", "Confirm it's you with your authenticator app.");
      if (!claims.signedInAt || now() - claims.signedInAt > PLATFORM_SIGN_IN_MAX_AGE_MS) {
        throw new ApiError(403, "PLATFORM_SIGN_IN_AGAIN", "For safety, sign in again (at least every 12 hours).");
      }
      response.locals.platformAdmin = admin;
      next();
    } catch (error) {
      next(error);
    }
  }];
}

async function audit(sql: SqlExecutor, admin: PlatformAdmin, action: string, metadata: Record<string, unknown> = {}, storeId: string | null = null) {
  await sql.query(
    `INSERT INTO "PlatformAuditEvent" ("id", "actorUserId", "action", "storeId", "metadata") VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [`pae-${randomUUID()}`, admin.userId, action, storeId, JSON.stringify(metadata)],
  );
}

export type PlatformStoreRow = { id: string; name: string; slug: string; country: string; currency: string; createdAt: string; archived: boolean; ownerEmail: string | null; plan: string | null; billingStatus: string | null; trialEndsAt: string | null };

export function createPlatformRouter(authProvider: AuthProvider, db: Database, now: () => number = Date.now): Router {
  const router = Router();
  router.use(...requirePlatformAdmin(authProvider, db, now));
  router.use((_request, response, next) => { response.set("Cache-Control", "no-store"); next(); });

  router.get("/me", (_request, response) => {
    const admin = response.locals.platformAdmin as PlatformAdmin;
    response.json({ role: admin.role, email: admin.email });
  });

  // Newest shops first, optionally matching a name or address. Logged.
  router.get("/stores", async (request, response, next) => {
    try {
      const admin = response.locals.platformAdmin as PlatformAdmin;
      const search = typeof request.query.q === "string" ? request.query.q.trim().slice(0, 100) : "";
      const stores = await db.transaction(async (sql) => {
        const result = await sql.query<{ id: string; name: string; slug: string; country: string; currency: string; createdAt: Date | string; archivedAt: Date | string | null; ownerEmail: string | null; plan: string | null; billingStatus: string | null; trialEndsAt: Date | string | null }>(
          `SELECT s."id", s."name", s."slug", s."country", s."currency", s."createdAt", s."archivedAt",
                  (SELECT u."email" FROM "StoreMembership" m JOIN "User" u ON u."id" = m."userId"
                    WHERE m."storeId" = s."id" AND m."role" = 'OWNER' ORDER BY m."createdAt" LIMIT 1) AS "ownerEmail",
                  b."plan", b."status" AS "billingStatus", b."trialEndsAt"
             FROM "Store" s
             LEFT JOIN "StoreBilling" b ON b."storeId" = s."id"
            WHERE $1 = '' OR s."name" ILIKE '%' || $1 || '%' OR s."slug" ILIKE '%' || $1 || '%'
            ORDER BY s."createdAt" DESC
            LIMIT 200`,
          [search],
        );
        await audit(sql, admin, "platform.stores.list", search ? { search } : {});
        return result.rows;
      });
      response.json({
        stores: stores.map((row): PlatformStoreRow => ({
          id: row.id, name: row.name, slug: row.slug, country: row.country, currency: row.currency,
          createdAt: new Date(row.createdAt).toISOString(), archived: Boolean(row.archivedAt), ownerEmail: row.ownerEmail,
          plan: row.plan, billingStatus: row.billingStatus, trialEndsAt: row.trialEndsAt ? new Date(row.trialEndsAt).toISOString() : null,
        })),
      });
    } catch (error) {
      next(error);
    }
  });
  return router;
}
