import { randomUUID } from "node:crypto";

interface Sql {
  query<Row = Record<string, unknown>>(text: string, values?: unknown[]): Promise<{ rows: Row[] }>;
}
export interface ReminderMessage { id: string; to: string; subject: string; html: string; text: string }
export interface ReminderMailer { send(message: ReminderMessage): Promise<unknown> }

/** A discount is mentioned once, this long before it ends. */
export const END_REMINDER_DAYS = 3;
/** Most emails in one tick. */
const BATCH = 50;

interface Candidate {
  id: string; storeId: string; title: string; code: string | null; endsAt: Date | string; uses: number | string; usageLimit: number | null;
  storeName: string; storeSlug: string; ownerEmail: string | null; timezone: string | null;
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

/**
 * Emails the shop owner once when a switched-on discount is about to end (within three days), so a successful offer
 * can be extended in time. The discount is claimed first ("endReminderSentAt"), so several servers never send twice;
 * a failed send gives the claim back for the next tick. Moving the end date clears the claim (in the service), so the
 * new date gets its own reminder. Without an email sender nothing is claimed.
 */
export class DiscountEndReminders {
  constructor(private readonly sql: Sql, private readonly mailer: ReminderMailer | undefined, private readonly options: { adminBaseUrl: string }) {}

  async run(now = new Date()): Promise<{ sent: number; failed: number; configured: boolean }> {
    if (!this.mailer) return { sent: 0, failed: 0, configured: false };
    const { rows } = await this.sql.query<Candidate>(
      `SELECT d.id, d."storeId", d.title, d.code, d."endsAt", d."usageLimit", s.name AS "storeName", s.slug AS "storeSlug", ss.timezone, owner.email AS "ownerEmail",
              (SELECT COUNT(DISTINCT od."orderId")::int FROM "OrderDiscount" od JOIN "Order" o ON o."storeId" = od."storeId" AND o.id = od."orderId"
                WHERE od."discountId" = d.id AND o.status <> 'CANCELLED') AS uses
       FROM "DiscountCode" d
       JOIN "Store" s ON s.id = d."storeId"
       LEFT JOIN "StoreSettings" ss ON ss."storeId" = d."storeId"
       LEFT JOIN LATERAL (
         SELECT u.email FROM "StoreMembership" m JOIN "User" u ON u.id = m."userId"
         WHERE m."storeId" = d."storeId" AND m.role = 'OWNER' ORDER BY m."createdAt" LIMIT 1
       ) owner ON true
       WHERE d.active AND d."endReminderSentAt" IS NULL AND d."endsAt" > $1 AND d."endsAt" <= $1::timestamptz + make_interval(days => $2)
       ORDER BY d."endsAt" LIMIT ${BATCH}`,
      [now, END_REMINDER_DAYS],
    );
    let sent = 0;
    let failed = 0;
    for (const candidate of rows) {
      if (!candidate.ownerEmail) continue;
      const claimed = await this.sql.query(`UPDATE "DiscountCode" SET "endReminderSentAt" = $2 WHERE id = $1 AND "endReminderSentAt" IS NULL RETURNING id`, [candidate.id, now]);
      if (!claimed.rows.length) continue;
      try {
        await this.mailer.send(reminderMessage(candidate, this.options.adminBaseUrl));
        sent += 1;
      } catch {
        failed += 1;
        await this.sql.query(`UPDATE "DiscountCode" SET "endReminderSentAt" = NULL WHERE id = $1`, [candidate.id]).catch(() => undefined);
      }
    }
    return { sent, failed, configured: true };
  }
}

export function reminderMessage(candidate: Candidate, adminBaseUrl: string): ReminderMessage {
  const timeZone = candidate.timezone || "Europe/London";
  const ends = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone }).format(new Date(candidate.endsAt));
  const uses = Number(candidate.uses);
  const used = candidate.usageLimit ? `${uses} of ${candidate.usageLimit} uses so far` : `${uses} ${uses === 1 ? "use" : "uses"} so far`;
  const link = `${adminBaseUrl.replace(/\/$/, "")}/admin/s/${encodeURIComponent(candidate.storeSlug)}/discounts/${encodeURIComponent(candidate.id)}`;
  const name = candidate.code && candidate.code !== candidate.title ? `${candidate.title} (code ${candidate.code})` : candidate.title;
  const subject = `Your discount "${candidate.title}" ends soon`;
  const text = `${name} in ${candidate.storeName} ends on ${ends}. It has ${used}.\n\nTo keep it going, open it and change or remove the end date:\n${link}\n\nIf it should end, you don't need to do anything.`;
  const html = `<p><strong>${escapeHtml(name)}</strong> in ${escapeHtml(candidate.storeName)} ends on ${escapeHtml(ends)}. It has ${escapeHtml(used)}.</p>`
    + `<p>To keep it going, open it and change or remove the end date:</p><p><a href="${escapeHtml(link)}">Open the discount</a></p>`
    + `<p>If it should end, you don't need to do anything.</p>`;
  return { id: `discount-end-${candidate.id}-${randomUUID()}`, to: candidate.ownerEmail!, subject, html, text };
}
