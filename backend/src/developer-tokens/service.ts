import { createHash, randomBytes, randomUUID } from "node:crypto";
import { roleHasPermission } from "../auth/permissions.js";
import { ApiError } from "../http/errors.js";
import type { StoreRole } from "../tenants/types.js";

export interface TokenSql { query<T = Record<string, unknown>>(text: string, values?: unknown[]): Promise<{ rows: T[] }> }

/** What a merchant sees about a token; the token itself is shown only once, when it is created. */
export interface DeveloperTokenSummary {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
}

/** A token that checked out: the store it belongs to and what it may do there. */
export interface VerifiedDeveloperToken { tokenId: string; storeId: string; scopes: string[] }

export const MAX_ACTIVE_TOKENS = 20;
export const TOKEN_PREFIX = "jdt_";
const EXPIRY_DAYS = [30, 90, 365] as const;
/** Writing "last used" on every request is wasteful; once a minute is precise enough. */
const LAST_USED_INTERVAL_MS = 60_000;

const columns = `"id", "name", "prefix", "scopes", "createdAt", "lastUsedAt", "expiresAt", "revokedAt"`;

export function hashDeveloperToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function isDeveloperToken(value: string): boolean {
  return value.startsWith(TOKEN_PREFIX);
}

/**
 * Developer tokens: long-lived keys an owner or developer of a store creates for `jelly-theme
 * upload` and `install`. Only a hash is stored. A token works only on its own store's theme package
 * routes, and only while its creator can still manage developer settings there, so removing someone
 * from the store also stops their tokens.
 */
export class DeveloperTokenService {
  private readonly lastUsedWrites = new Map<string, number>();

  constructor(private readonly sql: TokenSql) {}

  async list(storeId: string): Promise<DeveloperTokenSummary[]> {
    return (await this.sql.query<DeveloperTokenSummary>(`SELECT ${columns} FROM "DeveloperToken" WHERE "storeId" = $1 ORDER BY "createdAt" DESC, "id"`, [storeId])).rows;
  }

  async create(storeId: string, createdBy: string, input: { name: unknown; expiresInDays?: unknown }): Promise<{ token: string; summary: DeveloperTokenSummary }> {
    const name = typeof input.name === "string" ? input.name.trim().replace(/\s+/g, " ") : "";
    if (!name || name.length > 80) throw new ApiError(400, "INVALID_NAME", "Give the token a name of 1 to 80 characters, such as the computer or person using it.");
    if (input.expiresInDays !== undefined && input.expiresInDays !== null && !EXPIRY_DAYS.includes(input.expiresInDays as never)) throw new ApiError(400, "INVALID_EXPIRY", "A token can expire after 30, 90 or 365 days, or never.");
    const active = Number((await this.sql.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM "DeveloperToken" WHERE "storeId" = $1 AND "revokedAt" IS NULL AND ("expiresAt" IS NULL OR "expiresAt" > NOW())`, [storeId])).rows[0]?.count ?? 0);
    if (active >= MAX_ACTIVE_TOKENS) throw new ApiError(409, "TOO_MANY_TOKENS", `A store can have up to ${MAX_ACTIVE_TOKENS} active tokens. Revoke one you no longer use first.`);
    const token = `${TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
    const days = typeof input.expiresInDays === "number" ? input.expiresInDays : null;
    const summary = (await this.sql.query<DeveloperTokenSummary>(
      `INSERT INTO "DeveloperToken" ("id", "storeId", "name", "tokenHash", "prefix", "createdBy", "expiresAt")
       VALUES ($1, $2, $3, $4, $5, $6, CASE WHEN $7::int IS NULL THEN NULL ELSE NOW() + make_interval(days => $7::int) END)
       RETURNING ${columns}`,
      [randomUUID(), storeId, name, hashDeveloperToken(token), token.slice(0, TOKEN_PREFIX.length + 8), createdBy, days],
    )).rows[0];
    return { token, summary };
  }

  async revoke(storeId: string, id: string): Promise<void> {
    const rows = (await this.sql.query(`UPDATE "DeveloperToken" SET "revokedAt" = COALESCE("revokedAt", NOW()) WHERE "storeId" = $1 AND "id" = $2 RETURNING "id"`, [storeId, id])).rows;
    if (!rows.length) throw new ApiError(404, "NOT_FOUND", "That token was not found.");
  }

  /** Checks a token; null when it is unknown, revoked, expired, or its creator lost access to the store. */
  async verify(token: string): Promise<VerifiedDeveloperToken | null> {
    if (!isDeveloperToken(token) || token.length > 200) return null;
    const row = (await this.sql.query<{ id: string; storeId: string; scopes: string[]; role: StoreRole | null }>(
      `SELECT t."id", t."storeId", t."scopes", m."role"::text AS "role"
       FROM "DeveloperToken" t
       LEFT JOIN "User" u ON u."firebaseUid" = t."createdBy"
       LEFT JOIN "StoreMembership" m ON m."storeId" = t."storeId" AND m."userId" = u."id"
       WHERE t."tokenHash" = $1 AND t."revokedAt" IS NULL AND (t."expiresAt" IS NULL OR t."expiresAt" > NOW())`,
      [hashDeveloperToken(token)],
    )).rows[0];
    if (!row || !row.role || !roleHasPermission(row.role, "developer:edit")) return null;
    const now = Date.now();
    if (now - (this.lastUsedWrites.get(row.id) ?? 0) > LAST_USED_INTERVAL_MS) {
      this.lastUsedWrites.set(row.id, now);
      await this.sql.query(`UPDATE "DeveloperToken" SET "lastUsedAt" = NOW() WHERE "id" = $1`, [row.id]);
    }
    return { tokenId: row.id, storeId: row.storeId, scopes: row.scopes };
  }
}
