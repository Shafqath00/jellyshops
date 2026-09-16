import type { SqlExecutor, StripeWebhookEventRow } from "../../commerce/repository.js";

export class WebhookReceiptRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async record(input: { id: string; stripeEventId: string; type: string; payload: Record<string, unknown>; endpointFamily: "accounts-v2" | "connect-payments"; stripeAccountId?: string | null }): Promise<{ duplicate: boolean; row: StripeWebhookEventRow }> {
    const inserted = await this.sql.query<StripeWebhookEventRow>(
      `INSERT INTO "StripeWebhookEvent" ("id", "endpointFamily", "stripeEventId", "stripeAccountId", "type", "payload")
       VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT ("stripeEventId") DO NOTHING RETURNING *`,
      [input.id, input.endpointFamily, input.stripeEventId, input.stripeAccountId ?? null, input.type, input.payload],
    );
    if (inserted.rows[0]) return { duplicate: false, row: inserted.rows[0] };
    const existing = await this.sql.query<StripeWebhookEventRow>(`SELECT * FROM "StripeWebhookEvent" WHERE "stripeEventId" = $1`, [input.stripeEventId]);
    if (!existing.rows[0]) throw new Error("Webhook receipt was not persisted");
    return { duplicate: true, row: existing.rows[0] };
  }
}
