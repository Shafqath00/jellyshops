import type { PaymentRow, SqlExecutor } from "../../commerce/repository.js";

import type { EventPayload, ConnectPaymentEvent } from "./event-types.js";
import { expandableId, stringValue, findPaymentByIntent, getCheckoutAttemptId } from "./event-helpers.js";

const PAYMENT_INTENT_EVENTS = new Set([
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "payment_intent.canceled",
]);

async function processPaymentSucceeded(
  sql: SqlExecutor,
  payment: PaymentRow,
): Promise<void> {
  // Webhooks are delivered at least once. A single statement makes settlement
  // atomic and means a redelivery sees no HELD reservations to sell twice.
  await sql.query(
    `
      WITH attempt AS (
        SELECT "id"
        FROM "CheckoutAttempt"
        WHERE "orderId" = $1
          AND "storeId" = $2
        FOR UPDATE
      ),
      sold_reservations AS (
        UPDATE "InventoryReservation" AS reservation
        SET "status" = 'SOLD'
        FROM attempt
        WHERE reservation."attemptId" = attempt."id"
          AND reservation."status" = 'HELD'
        RETURNING
          reservation."storeId",
          reservation."variantId",
          reservation."quantity"
      ),
      settled_inventory AS (
        UPDATE "InventoryLevel" AS inventory
        SET
          "reserved" = inventory."reserved" - totals."quantity",
          "quantity" = inventory."quantity" - totals."quantity",
          "updatedAt" = CURRENT_TIMESTAMP
        FROM (
          SELECT
            "storeId",
            "variantId",
            SUM("quantity")::integer AS "quantity"
          FROM sold_reservations
          GROUP BY "storeId", "variantId"
        ) AS totals
        WHERE inventory."storeId" = totals."storeId"
          AND inventory."variantId" = totals."variantId"
          AND inventory."reserved" >= totals."quantity"
        RETURNING inventory."variantId"
      ),
      paid_payment AS (
        UPDATE "Payment"
        SET "status" = 'PAID'
        WHERE "id" = $3
          AND "status" IN ('PENDING', 'PROCESSING', 'FAILED')
        RETURNING "id"
      ),
      paid_order AS (
        UPDATE "Order"
        SET
          "status" = 'PAID',
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = $1
          AND "storeId" = $2
          AND "status" = 'PENDING_PAYMENT'
        RETURNING "id"
      ),
      completed_attempt AS (
        UPDATE "CheckoutAttempt"
        SET "status" = 'SUCCEEDED'
        WHERE "id" IN (SELECT "id" FROM attempt)
          AND "status" IN (
            'PAYMENT_INTENT_CREATING',
            'READY',
            'PROCESSING'
          )
        RETURNING "id"
      )
      SELECT
        (SELECT COUNT(*) FROM sold_reservations) AS "soldReservations",
        (SELECT COUNT(*) FROM settled_inventory) AS "settledInventory",
        (SELECT COUNT(*) FROM paid_payment) AS "paidPayment",
        (SELECT COUNT(*) FROM paid_order) AS "paidOrder",
        (SELECT COUNT(*) FROM completed_attempt) AS "completedAttempt"
    `,
    [payment.orderId, payment.storeId, payment.id],
  );
}

async function processPaymentCancelled(
  sql: SqlExecutor,
  payment: PaymentRow,
): Promise<void> {
  const cancelled =
    await sql.query(
      `
        UPDATE "Order"
        SET
          "status" = 'CANCELLED',
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = $1
          AND "storeId" = $2
          AND "status" = 'PENDING_PAYMENT'
        RETURNING "id"
      `,
      [
        payment.orderId,
        payment.storeId,
      ],
    );

  await sql.query(
    `
      UPDATE "Payment"
      SET "status" = 'CANCELLED'
      WHERE "id" = $1
        AND "status" IN ('PENDING', 'PROCESSING', 'FAILED')
    `,
    [payment.id],
  );

  if (cancelled.rows.length !== 1) {
    return;
  }

  const attemptId =
    await getCheckoutAttemptId(
      sql,
      payment,
    );

  if (!attemptId) {
    return;
  }

  await sql.query(
    `
      UPDATE "CheckoutAttempt"
      SET "status" = 'CANCELLED'
      WHERE "id" = $1
        AND "status" <> 'SUCCEEDED'
    `,
    [attemptId],
  );

  await sql.query(
    `
      WITH released AS (
        UPDATE "InventoryReservation"
        SET "status" = 'RELEASED'
        WHERE "attemptId" = $1
          AND "status" = 'HELD'
        RETURNING "storeId", "variantId", "quantity"
      ), totals AS (
        SELECT "storeId", "variantId", SUM("quantity")::integer AS quantity
        FROM released GROUP BY "storeId", "variantId"
      )
      UPDATE "InventoryLevel" inventory
      SET reserved = inventory.reserved - totals.quantity,
          "updatedAt" = CURRENT_TIMESTAMP
      FROM totals
      WHERE inventory."storeId" = totals."storeId"
        AND inventory."variantId" = totals."variantId"
    `,
    [attemptId],
  );
}

async function processPaymentFailed(
  sql: SqlExecutor,
  payment: PaymentRow,
): Promise<void> {
  await sql.query(
    `
      UPDATE "Payment"
      SET "status" = 'FAILED'
      WHERE "id" = $1
        AND "status" = 'PENDING'
    `,
    [payment.id],
  );
}

export async function processPaymentIntentEvent(
  sql: SqlExecutor,
  event: ConnectPaymentEvent,
  object: EventPayload,
): Promise<boolean> {
  if (
    !PAYMENT_INTENT_EVENTS.has(
      event.type,
    )
  ) {
    return false;
  }

  const objectId =
    stringValue(object.id);

  const paymentIntentId =
    objectId?.startsWith("pi_")
      ? objectId
      : expandableId(
          object.payment_intent,
        );

  if (
    !paymentIntentId ||
    !event.stripeAccountId
  ) {
    return true;
  }

  const payment =
    await findPaymentByIntent(
      sql,
      event.stripeAccountId,
      paymentIntentId,
    );

  if (!payment) {
    return true;
  }

  switch (event.type) {
    case "payment_intent.succeeded":
      await processPaymentSucceeded(
        sql,
        payment,
      );
      break;

    case "payment_intent.canceled":
      await processPaymentCancelled(
        sql,
        payment,
      );
      break;

    case "payment_intent.payment_failed":
      await processPaymentFailed(
        sql,
        payment,
      );
      break;
  }

  return true;
}
