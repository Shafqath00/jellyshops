import type {
  SqlExecutor,
  StripeWebhookEventRow,
} from "../../commerce/repository.js";

export type WebhookEndpointFamily =
  | "accounts-v2"
  | "connect-payments";

export interface RecordWebhookInput {
  id: string;
  stripeEventId: string;
  type: string;
  payload: Record<string, unknown>;
  endpointFamily: WebhookEndpointFamily;
  stripeAccountId?: string | null;
}

export interface WebhookReceiptResult {
  duplicate: boolean;
  row: StripeWebhookEventRow;
}

export class WebhookReceiptRepository {
  constructor(
    private readonly sql: SqlExecutor,
  ) {}

  async record(
    input: RecordWebhookInput,
  ): Promise<WebhookReceiptResult> {
    const inserted =
      await this.insertReceipt(input);

    if (inserted) {
      return {
        duplicate: false,
        row: inserted,
      };
    }

    const existing =
      await this.findByStripeEventId(
        input.stripeEventId,
      );

    if (!existing) {
      throw new Error(
        "Webhook receipt was not persisted",
      );
    }

    return {
      duplicate: true,
      row: existing,
    };
  }

  private async insertReceipt(
    input: RecordWebhookInput,
  ): Promise<StripeWebhookEventRow | null> {
    const result =
      await this.sql.query<StripeWebhookEventRow>(
        `
          INSERT INTO "StripeWebhookEvent" (
            "id",
            "endpointFamily",
            "stripeEventId",
            "stripeAccountId",
            "type",
            "payload"
          )
          VALUES ($1, $2, $3, $4, $5, $6)

          ON CONFLICT ("stripeEventId")
          DO NOTHING

          RETURNING *
        `,
        [
          input.id,
          input.endpointFamily,
          input.stripeEventId,
          input.stripeAccountId ?? null,
          input.type,
          input.payload,
        ],
      );

    return result.rows[0] ?? null;
  }

  private async findByStripeEventId(
    stripeEventId: string,
  ): Promise<StripeWebhookEventRow | null> {
    const result =
      await this.sql.query<StripeWebhookEventRow>(
        `
          SELECT *
          FROM "StripeWebhookEvent"
          WHERE "stripeEventId" = $1
        `,
        [stripeEventId],
      );

    return result.rows[0] ?? null;
  }
}