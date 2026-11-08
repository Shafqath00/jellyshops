import { ApiError } from "../../http/errors.js";
import { accessToken, hashPassword, MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH, tokenMatches, verifyPassword } from "./password.js";

export interface AccessSql { query<T = Record<string, unknown>>(text: string, values?: unknown[]): Promise<{ rows: T[] }> }

interface AccessRow { passwordHash: string | null; enabled: boolean; message: string }

export interface AccessSettings { enabled: boolean; hasPassword: boolean; message: string }
export interface AccessStatus { protected: boolean; unlocked: boolean; message: string }

const MAX_ATTEMPTS = 8;
const WINDOW_MS = 60_000;

/**
 * Password protection for a store's public pages. Merchants set it
 * (`getSettings` / `saveSettings`); shoppers check their access token
 * (`status`) or exchange the password for one (`unlock`, rate limited per store
 * and address). This gates the storefront pages; it does not hide the public
 * catalogue API, so it is not a way to keep data secret.
 */
export class StorefrontAccessService {
  private readonly attempts = new Map<string, number[]>();

  constructor(private readonly sql: AccessSql, private readonly now: () => number = () => Date.now()) {}

  private async row(storeId: string): Promise<AccessRow | null> {
    return (await this.sql.query<AccessRow>(`SELECT "passwordHash", "enabled", "message" FROM "StorefrontAccess" WHERE "storeId" = $1`, [storeId])).rows[0] ?? null;
  }

  async getSettings(storeId: string): Promise<AccessSettings> {
    const row = await this.row(storeId);
    return { enabled: row?.enabled ?? false, hasPassword: Boolean(row?.passwordHash), message: row?.message ?? "" };
  }

  /** Turns the protection on or off, sets a new password, and/or changes the message shown above the password box. */
  async saveSettings(storeId: string, input: { enabled?: boolean; password?: string; message?: string }): Promise<AccessSettings> {
    const current = await this.row(storeId);
    let hash = current?.passwordHash ?? null;
    if (input.password !== undefined) {
      if (input.password.length < MIN_PASSWORD_LENGTH || input.password.length > MAX_PASSWORD_LENGTH) throw new ApiError(400, "INVALID_PASSWORD", `Use a password of ${MIN_PASSWORD_LENGTH} to ${MAX_PASSWORD_LENGTH} characters.`);
      hash = await hashPassword(input.password);
    }
    const enabled = input.enabled ?? current?.enabled ?? false;
    if (enabled && !hash) throw new ApiError(400, "PASSWORD_REQUIRED", "Choose a password before turning protection on.");
    const message = (input.message ?? current?.message ?? "").trim();
    if (message.length > 500) throw new ApiError(400, "MESSAGE_TOO_LONG", "The message can be at most 500 characters.");
    await this.sql.query(
      `INSERT INTO "StorefrontAccess" ("storeId", "passwordHash", "enabled", "message", "updatedAt") VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT ("storeId") DO UPDATE SET "passwordHash" = EXCLUDED."passwordHash", "enabled" = EXCLUDED."enabled", "message" = EXCLUDED."message", "updatedAt" = NOW()`,
      [storeId, hash, enabled, message],
    );
    return { enabled, hasPassword: Boolean(hash), message };
  }

  /** Whether the store asks for a password, and whether this token already unlocks it. */
  async status(storeId: string, token?: unknown): Promise<AccessStatus> {
    const row = await this.row(storeId);
    if (!row?.enabled || !row.passwordHash) return { protected: false, unlocked: true, message: "" };
    return { protected: true, unlocked: tokenMatches(storeId, row.passwordHash, token), message: row.message };
  }

  /** The access token for a correct password, or null. Too many wrong tries in a minute are refused. */
  async unlock(storeId: string, password: string, address: string): Promise<string | null> {
    const key = `${storeId}|${address}`;
    const recent = (this.attempts.get(key) ?? []).filter((time) => this.now() - time < WINDOW_MS);
    if (recent.length >= MAX_ATTEMPTS) throw new ApiError(429, "TOO_MANY_ATTEMPTS", "Too many tries. Wait a minute and try again.");
    const row = await this.row(storeId);
    if (!row?.enabled || !row.passwordHash) return null;
    if (password.length > MAX_PASSWORD_LENGTH || !await verifyPassword(password, row.passwordHash)) {
      this.attempts.set(key, [...recent, this.now()]);
      return null;
    }
    this.attempts.delete(key);
    return accessToken(storeId, row.passwordHash);
  }
}
