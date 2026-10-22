import type { PaymentRow, SqlExecutor } from "../../commerce/repository.js";

import type { EventPayload, ConnectPaymentEvent } from "./event-types.js";
import { expandableId, stringValue } from "./event-helpers.js";

function refundStatus(
  eventType: string,
  objectStatus?: unknown,
): "PENDING" | "SUCCEEDED" | "FAILED" {
  if (
    eventType ===
    "refund.succeeded" || objectStatus === "succeeded"
  ) {
    return "SUCCEEDED";
  }

  if (
    eventType ===
    "refund.failed" || objectStatus === "failed" || objectStatus === "canceled"
  ) {
    return "FAILED";
  }

  return "PENDING";
}

async function findRefundPayment(
  sql: SqlExecutor,
  stripeAccountId: string,
  paymentIntentId: string | null,
  chargeId: string | null,
): Promise<PaymentRow | null> {
  const result =
    await sql.query<PaymentRow>(
      `
        SELECT *
        FROM "Payment"
        WHERE "stripeAccountId" = $1
          AND (
            "paymentIntentId" = $2
            OR "chargeId" = $3
          )
      `,
      [
        stripeAccountId,
        paymentIntentId,
        chargeId,
      ],
    );

  return result.rows[0] ?? null;
}

async function upsertRefund(
  sql: SqlExecutor,
  event: ConnectPaymentEvent,
  object: EventPayload,
  payment: PaymentRow,
  stripeRefundId: string,
): Promise<void> {
  const amount =
    typeof object.amount === "number"
      ? object.amount
      : payment.amountMinor;

  await sql.query(
    `
      INSERT INTO "Refund" (
        "id",
        "storeId",
        "orderId",
        "paymentId",
        "stripeRefundId",
        "amountMinor",
        "status"
      )
      VALUES (
        $1, $2, $3, $4,
        $5, $6, $7
      )

      ON CONFLICT ("stripeRefundId")
      DO UPDATE
      SET "status" = EXCLUDED."status"
    `,
    [
      `refund-${stripeRefundId}`,
      payment.storeId,
      payment.orderId,
      payment.id,
      stripeRefundId,
      amount,
      refundStatus(event.type, object.status),
    ],
  );
}

async function processChargeRefunded(
  sql: SqlExecutor,
  payment: PaymentRow,
): Promise<void> {
  await sql.query(
    `
      UPDATE "Payment"
      SET "status" = 'REFUNDED'
      WHERE "id" = $1
    `,
    [payment.id],
  );

  await sql.query(
    `
      UPDATE "Order"
      SET
        "status" = 'REFUNDED',
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = $1
        AND "status" IN (
          'PAID',
          'CONFIRMED',
          'PROCESSING',
          'SHIPPED',
          'DELIVERED'
        )
    `,
    [payment.orderId],
  );

  await sql.query(
    `
      UPDATE "InventoryLevel" il

      SET
        "quantity" =
          il."quantity" + ir."quantity"

      FROM "InventoryReservation" ir

      JOIN "OrderItem" oi
        ON oi."orderId" = $1
        AND oi."storeId" = $2
        AND oi."variantId" =
          ir."variantId"

      WHERE il."storeId" = $2
        AND il."variantId" =
          ir."variantId"

        AND ir."status" = 'SOLD'
        AND EXISTS (
          SELECT 1 FROM "Order" original_order
          WHERE original_order."id" = $1
            AND original_order."storeId" = $2
            AND original_order."fulfilmentStartedAt" IS NULL
        )

        AND ir."attemptId" IN (
          SELECT "id"
          FROM "CheckoutAttempt"
          WHERE "orderId" = $1
            AND "storeId" = $2
        )

        AND NOT EXISTS (
          SELECT 1
          FROM "Refund" r
          WHERE r."orderId" = $1
            AND r."inventoryRestoredAt"
              IS NOT NULL
        )
    `,
    [
      payment.orderId,
      payment.storeId,
    ],
  );

  await sql.query(
    `
      UPDATE "Refund"
      SET
        "inventoryRestoredAt" =
          CURRENT_TIMESTAMP
      WHERE "orderId" = $1
        AND "status" = 'SUCCEEDED'
        AND "inventoryRestoredAt"
          IS NULL
    `,
    [payment.orderId],
  );
}

export async function processRefundEvent(
  sql: SqlExecutor,
  event: ConnectPaymentEvent,
  object: EventPayload,
): Promise<void> {
  const isRefundEvent =
    event.type.startsWith("refund.") ||
    event.type ===
      "charge.refunded";

  if (
    !isRefundEvent ||
    !event.stripeAccountId
  ) {
    return;
  }

  const stripeRefundId =
    event.type === "charge.refunded"
      ? null
      : stringValue(object.id);

  const paymentIntentId =
    expandableId(
      object.payment_intent,
    );

  const objectId =
    stringValue(object.id);

  const chargeId =
    objectId?.startsWith("ch_")
      ? objectId
      : null;

  const payment =
    await findRefundPayment(
      sql,
      event.stripeAccountId,
      paymentIntentId,
      chargeId,
    );

  if (!payment) {
    return;
  }

  if (stripeRefundId) {
    await upsertRefund(
      sql,
      event,
      object,
      payment,
      stripeRefundId,
    );
  }

  if (
    event.type === "charge.refunded" &&
    (object.refunded === true ||
      (typeof object.amount === "number" && object.amount > 0 &&
        typeof object.amount_refunded === "number" && object.amount_refunded >= object.amount))
  ) {
    await processChargeRefunded(
      sql,
      payment,
    );
  }
}
