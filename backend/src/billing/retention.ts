import { BILLING_CONFIG } from "./limits-config.js";

/**
 * Closed shops and when their data may be deleted (docs/plans/2026-11-25-billing-trial-limits.md, step 5).
 *
 * - A shop counts as closed from: the trial end (an expired trial; the shop's billing start when it never had one),
 *   the grace end (a failed payment), the end of its last paid period (cancelled) or the last change (paused).
 * - BILLING_CONFIG.retentionWarningDays before the deletion date the owner is emailed once (billing job, only when
 *   BILLING_ENFORCED is on, because only then is the shop really closed).
 * - Deletion date = the later of closed + retentionDays and warned + retentionWarningDays, so nobody loses a shop
 *   without that much notice. A shop that was never warned has no deletion date.
 * - Nothing is deleted automatically: due shops are listed in the platform admin for a person to deal with. A shop
 *   that pays again leaves the list at once (its status changes).
 */

const DAY = 24 * 60 * 60 * 1000;

interface Sql {
  query(text: string, values?: unknown[]): Promise<{ rows: unknown[] }>;
}

/** SQL for the moment a billing row (alias `b`) became closed; NULL when it is not closed. `$1` must be now. */
export const CLOSED_SINCE_SQL = `(CASE b."status"
  WHEN 'expired' THEN COALESCE(b."trialEndsAt", b."createdAt")
  WHEN 'trialing' THEN CASE WHEN b."stripeSubscriptionId" IS NULL AND b."trialEndsAt" <= $1::timestamptz THEN b."trialEndsAt" END
  WHEN 'past_due' THEN CASE WHEN b."graceEndsAt" <= $1::timestamptz THEN b."graceEndsAt" END
  WHEN 'canceled' THEN CASE WHEN COALESCE(b."currentPeriodEnd", b."updatedAt") <= $1::timestamptz THEN COALESCE(b."currentPeriodEnd", b."updatedAt") END
  WHEN 'paused' THEN b."updatedAt"
END)`;

/** The key of the warning email in "BillingReminder", one per closing. */
export const retentionWarningKey = (closedSince: Date) => `retention-warning:${closedSince.toISOString()}`;

/** When warning starts: closed for retentionDays - retentionWarningDays. */
export const warnAfterMs = () => (BILLING_CONFIG.retentionDays - BILLING_CONFIG.retentionWarningDays) * DAY;

/** The deletion date for a shop closed at `closedSince` and warned at `warnedAt` (null when never warned). */
export function deletionDate(closedSince: Date, warnedAt: Date | null): Date | null {
  if (!warnedAt) return null;
  return new Date(Math.max(closedSince.getTime() + BILLING_CONFIG.retentionDays * DAY, warnedAt.getTime() + BILLING_CONFIG.retentionWarningDays * DAY));
}

export interface RetentionRow {
  storeId: string;
  name: string;
  slug: string;
  ownerEmail: string | null;
  status: string;
  closedSince: string;
  warnedAt: string | null;
  deleteFrom: string | null;
  /** The deletion date has passed: a person may delete the shop. */
  due: boolean;
}

const asDate = (value: unknown) => (value === null || value === undefined ? null : value instanceof Date ? value : new Date(String(value)));

/** Shops closed long enough to be warned (or past it), oldest closing first, up to 500. */
export async function listRetention(sql: Sql, now: Date): Promise<RetentionRow[]> {
  const result = await sql.query(
    `SELECT * FROM (
       SELECT s."id" AS "storeId", s."name", s."slug", b."status", ${CLOSED_SINCE_SQL} AS "closedSince",
              (SELECT u."email" FROM "StoreMembership" m JOIN "User" u ON u."id" = m."userId"
                WHERE m."storeId" = s."id" AND m."role" = 'OWNER' ORDER BY m."createdAt" LIMIT 1) AS "ownerEmail"
         FROM "StoreBilling" b JOIN "Store" s ON s."id" = b."storeId"
     ) closed
     LEFT JOIN LATERAL (
       SELECT max(r."sentAt") AS "warnedAt" FROM "BillingReminder" r
        WHERE r."storeId" = closed."storeId" AND r."kind" LIKE 'retention-warning:%' AND r."sentAt" >= closed."closedSince"
     ) warning ON true
     WHERE closed."closedSince" <= $1::timestamptz - make_interval(secs => $2)
     ORDER BY closed."closedSince" LIMIT 500`,
    [now, warnAfterMs() / 1000],
  );
  return (result.rows as Array<Record<string, unknown>>).map((row) => {
    const closedSince = asDate(row.closedSince)!;
    const warnedAt = asDate(row.warnedAt);
    const deleteFrom = deletionDate(closedSince, warnedAt);
    return {
      storeId: String(row.storeId), name: String(row.name), slug: String(row.slug), ownerEmail: (row.ownerEmail as string | null) ?? null,
      status: String(row.status), closedSince: closedSince.toISOString(), warnedAt: warnedAt?.toISOString() ?? null,
      deleteFrom: deleteFrom?.toISOString() ?? null, due: Boolean(deleteFrom && deleteFrom.getTime() <= now.getTime()),
    };
  });
}
