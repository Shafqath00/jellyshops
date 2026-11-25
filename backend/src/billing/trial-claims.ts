import { createHash } from "node:crypto";

/**
 * One free trial per owner (docs/plans/2026-11-25-billing-trial-limits.md, step 3).
 *
 * A trial is claimed twice when a shop starts one: by the owner's account and by their normalised email, in table
 * "TrialClaim" (migration 20261125010000_trial_claims.sql). A later shop whose owner or email has a claim starts
 * without a trial: billing status `expired` with no trial end, so it pays at once (its admin stays open). Claims are
 * never deleted, also when the shop is, so deleting a shop does not give a new trial.
 *
 * Emails are stored only as a SHA-256 of the normalised address. Normalising: lower case, `+tag` dropped for every
 * provider, and for Gmail dots dropped and googlemail.com read as gmail.com.
 */

interface Sql {
  query(text: string, values?: unknown[]): Promise<{ rows: unknown[] }>;
}

const GMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

export function normaliseEmail(email: string): string {
  const value = email.trim().toLowerCase();
  const at = value.lastIndexOf("@");
  if (at <= 0 || at === value.length - 1) return value;
  let local = value.slice(0, at);
  let domain = value.slice(at + 1);
  const plus = local.indexOf("+");
  if (plus > 0) local = local.slice(0, plus);
  if (GMAIL_DOMAINS.has(domain)) {
    local = local.replace(/\./g, "");
    domain = "gmail.com";
  }
  return `${local}@${domain}`;
}

export function emailClaimKey(email: string): string {
  return createHash("sha256").update(normaliseEmail(email), "utf8").digest("hex");
}

/** Whether the table exists yet (checked before any statement that could fail and abort the store's transaction). */
export async function trialClaimsReady(sql: Sql): Promise<boolean> {
  const result = await sql.query(`SELECT to_regclass('public."TrialClaim"')::text AS "table"`);
  return Boolean((result.rows[0] as { table?: string | null } | undefined)?.table);
}

/**
 * Claims the trial for this owner and email, inside the transaction that creates the shop. Returns false when either
 * has already had one (or another request claimed it a moment ago). Before the migration every shop gets a trial.
 */
export async function claimTrial(sql: Sql, input: { userId: number; email: string | null; storeId: string }): Promise<boolean> {
  if (!(await trialClaimsReady(sql))) return true;
  const keys: Array<[string, string]> = [["user", String(input.userId)]];
  if (input.email && input.email.includes("@")) keys.push(["email", emailClaimKey(input.email)]);

  const taken = await sql.query(
    `SELECT 1 FROM "TrialClaim" WHERE ("kind", "value") IN (${keys.map((_, index) => `($${index * 2 + 1}, $${index * 2 + 2})`).join(", ")}) LIMIT 1`,
    keys.flat(),
  );
  if (taken.rows.length > 0) return false;

  // Email first: if it loses a race the owner's own claim is not written for a trial they did not get.
  for (const [kind, value] of [...keys].reverse()) {
    const inserted = await sql.query(
      `INSERT INTO "TrialClaim" ("kind", "value", "storeId") VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING "kind"`,
      [kind, value, input.storeId],
    );
    if (inserted.rows.length === 0) return false;
  }
  return true;
}
