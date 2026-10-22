import type { PaymentRow, SqlExecutor } from "../../commerce/repository.js";

import type { EventPayload } from "./event-types.js";

export function asRecord(
  value: unknown,
): EventPayload {
  return value &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? (value as EventPayload)
    : {};
}

export function stripeObject(
  payload: EventPayload,
): EventPayload {
  const data = asRecord(payload.data);

  return asRecord(data.object);
}

export function expandableId(
  value: unknown,
): string | null {
  if (typeof value === "string") {
    return value;
  }

  const object = asRecord(value);

  return typeof object.id === "string"
    ? object.id
    : null;
}

export function stringValue(
  value: unknown,
): string | null {
  return typeof value === "string"
    ? value
    : null;
}

export async function markProcessed(
  sql: SqlExecutor,
  eventId: string,
): Promise<void> {
  await sql.query(
    `
      UPDATE "StripeWebhookEvent"
      SET "processedAt" = CURRENT_TIMESTAMP
      WHERE "id" = $1
        AND "processedAt" IS NULL
    `,
    [eventId],
  );
}

export async function findPaymentByIntent(
  sql: SqlExecutor,
  stripeAccountId: string,
  paymentIntentId: string,
): Promise<PaymentRow | null> {
  const result =
    await sql.query<PaymentRow>(
      `
        SELECT *
        FROM "Payment"
        WHERE "stripeAccountId" = $1
          AND "paymentIntentId" = $2
        FOR UPDATE
      `,
      [
        stripeAccountId,
        paymentIntentId,
      ],
    );

  return result.rows[0] ?? null;
}

export async function getCheckoutAttemptId(
  sql: SqlExecutor,
  payment: PaymentRow,
): Promise<string | null> {
  const result = await sql.query<{
    id: string;
  }>(
    `
      SELECT "id"
      FROM "CheckoutAttempt"
      WHERE "orderId" = $1
        AND "storeId" = $2
    `,
    [
      payment.orderId,
      payment.storeId,
    ],
  );

  return result.rows[0]?.id ?? null;
}
