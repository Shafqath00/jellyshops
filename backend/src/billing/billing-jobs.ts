import { randomUUID } from "node:crypto";
import { BILLING_CONFIG } from "./limits-config.js";
import { CLOSED_SINCE_SQL, retentionWarningKey, warnAfterMs } from "./retention.js";
import type { BillingStatus } from "./store-billing.js";

/**
 * The scheduled billing work (docs/plans/2026-11-25-billing-trial-limits.md, step 2), run on every tick of the
 * existing scheduled worker:
 *
 * 1. Trials that ended without a subscription move from `trialing` to `expired`. Stripe webhooks stay the source of
 *    truth for everything paid; this only moves the one state Stripe knows nothing about.
 * 2. The owner gets one email for each of: trial day 10 and day 13 (BILLING_CONFIG.reminderDays), trial ended, a
 *    failed payment (with the date the shop closes) and, once BILLING_ENFORCED is on, the shop closing at the end of
 *    the grace period and the warning before its data may be deleted (step 5, see retention.ts).
 *
 * Each email is claimed in "BillingReminder" before it is sent (primary key per store and kind), so several server
 * instances never send it twice; a failed send gives the claim back so the next tick retries. Without an email
 * sender nothing is claimed, and nothing is sent later for reminders whose moment has passed.
 */

interface Sql {
  query(text: string, values?: unknown[]): Promise<{ rows: unknown[] }>;
}

export interface BillingMessage { id: string; to: string; subject: string; html: string; text: string }
export interface BillingMailer { send(message: BillingMessage): Promise<unknown> }

const DAY = 24 * 60 * 60 * 1000;
/** Trial-ended emails are only sent for trials that ended this recently (not for old test shops on the first run). */
const TRIAL_ENDED_EMAIL_WINDOW = 3 * DAY;
/** Most emails sent in one tick. */
const BATCH = 100;

export interface BillingCandidate {
  storeId: string;
  storeName: string;
  storeSlug: string;
  ownerEmail: string | null;
  status: BillingStatus;
  trialEndsAt: Date | null;
  graceEndsAt: Date | null;
  /** When the shop closed (see retention.ts), or null while it is open. */
  closedSince?: Date | null;
}

export type ReminderKind =
  | { kind: "trial-day"; day: number }
  | { kind: "trial-ended" }
  | { kind: "payment-failed"; graceEndsAt: Date }
  | { kind: "shop-closed"; graceEndsAt: Date }
  | { kind: "retention-warning"; closedSince: Date; deleteFrom: Date };

/** The key stored in "BillingReminder": one per trial reminder, one per failed-payment episode (by its grace end). */
export function reminderKey(reminder: ReminderKind): string {
  switch (reminder.kind) {
    case "trial-day": return `trial-day-${reminder.day}`;
    case "trial-ended": return "trial-ended";
    case "payment-failed": return `payment-failed:${reminder.graceEndsAt.toISOString()}`;
    case "shop-closed": return `shop-closed:${reminder.graceEndsAt.toISOString()}`;
    case "retention-warning": return retentionWarningKey(reminder.closedSince);
  }
}

/**
 * The email a shop is due right now, or null. Only the latest due trial reminder counts, so a tick that runs late
 * never sends "4 days left" after "1 day left". Pure, so the rules are easy to test.
 */
export function dueReminder(candidate: BillingCandidate, now: Date, enforced: boolean): ReminderKind | null {
  const time = now.getTime();
  // Closed long enough that its data will be deleted: the most important email, and only while really closed.
  if (enforced && candidate.closedSince && time - candidate.closedSince.getTime() >= warnAfterMs()) {
    const deleteFrom = new Date(Math.max(
      candidate.closedSince.getTime() + BILLING_CONFIG.retentionDays * DAY,
      time + BILLING_CONFIG.retentionWarningDays * DAY,
    ));
    return { kind: "retention-warning", closedSince: candidate.closedSince, deleteFrom };
  }
  if (candidate.status === "trialing" && candidate.trialEndsAt) {
    const ends = candidate.trialEndsAt.getTime();
    if (ends <= time) return null; // the job marks it expired first; the next pass sends trial-ended
    const elapsed = BILLING_CONFIG.trialDays * DAY - (ends - time);
    const day = [...BILLING_CONFIG.reminderDays].reverse().find((value) => elapsed >= value * DAY);
    return day === undefined ? null : { kind: "trial-day", day };
  }
  if (candidate.status === "expired" && candidate.trialEndsAt) {
    return time - candidate.trialEndsAt.getTime() <= TRIAL_ENDED_EMAIL_WINDOW ? { kind: "trial-ended" } : null;
  }
  if (candidate.status === "past_due" && candidate.graceEndsAt) {
    if (candidate.graceEndsAt.getTime() > time) return { kind: "payment-failed", graceEndsAt: candidate.graceEndsAt };
    return enforced ? { kind: "shop-closed", graceEndsAt: candidate.graceEndsAt } : null;
  }
  return null;
}

const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
const day = (value: Date) => value.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" });
const pounds = (minor: number) => `£${(minor / 100).toFixed(minor % 100 === 0 ? 0 : 2)}`;
const PRICE = `${pounds(BILLING_CONFIG.prices.monthMinor)} a month (or ${pounds(BILLING_CONFIG.prices.yearMinor)} a year)`;

/** Subject and wording for one email, in plain words. */
export function reminderMessage(reminder: ReminderKind, candidate: BillingCandidate, billingUrl: string): Omit<BillingMessage, "id" | "to"> {
  const shop = candidate.storeName.replace(/[\r\n]/g, " ");
  let subject: string;
  let lines: string[];
  switch (reminder.kind) {
    case "trial-day": {
      const left = BILLING_CONFIG.trialDays - reminder.day;
      subject = `${left} day${left === 1 ? "" : "s"} left in your ${shop} trial`;
      lines = [
        `Your free trial of ${shop} ends on ${candidate.trialEndsAt ? day(candidate.trialEndsAt) : "soon"}.`,
        `To keep your shop open after that, choose a plan: ${PRICE}. Everything you've built stays as it is.`,
      ];
      break;
    }
    case "trial-ended":
      subject = `Your ${shop} trial has ended`;
      lines = [
        `Your free trial of ${shop} has ended, so your shop is closed to shoppers for now.`,
        `Nothing has been deleted. Choose a plan (${PRICE}) to open it again. We keep your shop for ${BILLING_CONFIG.retentionDays} days.`,
      ];
      break;
    case "payment-failed":
      subject = `Payment for ${shop} didn't go through`;
      lines = [
        `We couldn't take this month's payment for ${shop}. Your shop stays open while we try again.`,
        `Please update your card by ${day(reminder.graceEndsAt)}, or your shop will close to shoppers on that day.`,
      ];
      break;
    case "retention-warning":
      subject = `We'll delete ${shop} on ${day(reminder.deleteFrom)} unless you choose a plan`;
      lines = [
        `${shop} has been closed to shoppers since ${day(reminder.closedSince)}.`,
        `We keep closed shops for ${BILLING_CONFIG.retentionDays} days. On or after ${day(reminder.deleteFrom)} we may delete it, with its products, photos, orders and customers. Choose a plan (${PRICE}) before then to keep it.`,
        "If you'd like a copy of your products or orders first, export them from your admin.",
      ];
      break;
    case "shop-closed":
      subject = `${shop} is closed until payment goes through`;
      lines = [
        `We still couldn't take payment for ${shop}, so it's now closed to shoppers. Your admin stays open.`,
        `Update your card to open it again. We keep your shop for ${BILLING_CONFIG.retentionDays} days.`,
      ];
      break;
  }
  const action = reminder.kind === "trial-day" || reminder.kind === "trial-ended" || reminder.kind === "retention-warning" ? "Choose a plan" : "Update your card";
  const text = [...lines, `${action}: ${billingUrl}`, "Jellyshop"].join("\n\n");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escape(subject)}</title></head><body style="margin:0;padding:32px 16px;background:#f6f6f4;font-family:Arial,sans-serif;color:#111">`
    + `<div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e3e3df;padding:32px">`
    + `<p style="margin:0 0 20px;font-weight:bold;font-size:18px">Jellyshop</p>`
    + lines.map((line) => `<p style="margin:0 0 16px;font-size:15px;line-height:24px">${escape(line)}</p>`).join("")
    + `<p style="margin:24px 0 0"><a href="${escape(billingUrl)}" style="display:inline-block;padding:12px 20px;background:#111;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold">${action}</a></p>`
    + `<p style="margin:28px 0 0;font-size:12px;color:#555">You get this email because you own ${escape(shop)} on Jellyshop.</p></div></body></html>`;
  return { subject, text, html };
}

interface CandidateRow {
  storeId: string;
  storeName: string;
  storeSlug: string;
  ownerEmail: string | null;
  status: BillingStatus;
  trialEndsAt: Date | string | null;
  graceEndsAt: Date | string | null;
  closedSince: Date | string | null;
}
const asDate = (value: Date | string | null) => (value === null ? null : value instanceof Date ? value : new Date(value));

export interface BillingJobResult { ready: boolean; expired: number; sent: number; failed: number; configured: boolean }

export class BillingJobs {
  constructor(
    private readonly sql: Sql,
    private readonly mailer: BillingMailer | undefined,
    private readonly options: { adminBaseUrl: string; enforced: boolean; now?: () => Date },
  ) {}

  private now() { return this.options.now?.() ?? new Date(); }

  /** The shop's billing page in the admin (works with and without shop subdomains). */
  billingUrl(storeSlug: string): string {
    return `${this.options.adminBaseUrl.replace(/\/$/, "")}/admin/s/${encodeURIComponent(storeSlug)}/settings/billing`;
  }

  async run(): Promise<BillingJobResult> {
    const ready = await this.sql.query(`SELECT to_regclass('public."BillingReminder"')::text AS "table"`);
    if (!(ready.rows[0] as { table?: string | null } | undefined)?.table) return { ready: false, expired: 0, sent: 0, failed: 0, configured: Boolean(this.mailer) };
    const now = this.now();
    const expired = await this.sql.query(
      `UPDATE "StoreBilling" SET "status" = 'expired', "updatedAt" = NOW()
       WHERE "status" = 'trialing' AND "stripeSubscriptionId" IS NULL AND "trialEndsAt" <= $1 RETURNING "storeId"`,
      [now],
    );
    if (!this.mailer) return { ready: true, expired: expired.rows.length, sent: 0, failed: 0, configured: false };

    const firstReminder = Math.min(...BILLING_CONFIG.reminderDays);
    const candidates = await this.sql.query(
      `SELECT b."storeId", s."name" AS "storeName", s."slug" AS "storeSlug", owner."email" AS "ownerEmail", b."status", b."trialEndsAt", b."graceEndsAt", ${CLOSED_SINCE_SQL} AS "closedSince"
       FROM "StoreBilling" b
       JOIN "Store" s ON s."id" = b."storeId"
       LEFT JOIN LATERAL (
         SELECT u."email" FROM "StoreMembership" m JOIN "User" u ON u."id" = m."userId"
         WHERE m."storeId" = b."storeId" AND m."role" = 'OWNER' ORDER BY m."createdAt" LIMIT 1
       ) owner ON true
       WHERE (b."status" = 'trialing' AND b."stripeSubscriptionId" IS NULL AND b."trialEndsAt" <= $1::timestamptz + make_interval(days => $2))
          OR (b."status" = 'expired' AND b."trialEndsAt" >= $1::timestamptz - make_interval(days => 3))
          OR (b."status" = 'past_due' AND b."graceEndsAt" IS NOT NULL)
          OR ($5 AND ${CLOSED_SINCE_SQL} <= $1::timestamptz - make_interval(secs => $4)
              -- Already warned for this closing: no longer a candidate, so warned shops never crowd out others.
              AND NOT EXISTS (SELECT 1 FROM "BillingReminder" r WHERE r."storeId" = b."storeId" AND r."kind" LIKE 'retention-warning:%' AND r."sentAt" >= ${CLOSED_SINCE_SQL}))
       ORDER BY b."storeId" LIMIT $3`,
      [now, BILLING_CONFIG.trialDays - firstReminder, BATCH * 2, warnAfterMs() / 1000, this.options.enforced],
    );
    let sent = 0;
    let failed = 0;
    for (const raw of candidates.rows as CandidateRow[]) {
      if (sent + failed >= BATCH) break;
      const candidate: BillingCandidate = { ...raw, trialEndsAt: asDate(raw.trialEndsAt), graceEndsAt: asDate(raw.graceEndsAt), closedSince: asDate(raw.closedSince) };
      const reminder = dueReminder(candidate, now, this.options.enforced);
      if (!reminder || !candidate.ownerEmail) continue;
      const kind = reminderKey(reminder);
      const claimed = await this.sql.query(
        `INSERT INTO "BillingReminder" ("storeId", "kind", "sentTo", "sentAt") VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING RETURNING "storeId"`,
        [candidate.storeId, kind, candidate.ownerEmail, now],
      );
      if (claimed.rows.length === 0) continue;
      try {
        await this.mailer.send({ id: randomUUID(), to: candidate.ownerEmail, ...reminderMessage(reminder, candidate, this.billingUrl(candidate.storeSlug)) });
        sent += 1;
      } catch {
        failed += 1;
        // Give the claim back so the next tick tries again.
        await this.sql.query(`DELETE FROM "BillingReminder" WHERE "storeId" = $1 AND "kind" = $2`, [candidate.storeId, kind]).catch(() => undefined);
      }
    }
    return { ready: true, expired: expired.rows.length, sent, failed, configured: true };
  }
}
