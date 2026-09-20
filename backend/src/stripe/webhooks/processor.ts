import type {
  PaymentRow,
  SqlExecutor,
} from "../../commerce/repository.js";

type EventPayload =
  Record<string, unknown>;

export interface ConnectPaymentEvent {
  id: string;
  type: string;
  stripeAccountId: string | null;
  payload: EventPayload;
}

const PAYMENT_INTENT_EVENTS = new Set([
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "payment_intent.canceled",
]);

function asRecord(
  value: unknown,
): EventPayload {
  return value &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? (value as EventPayload)
    : {};
}

function stripeObject(
  payload: EventPayload,
): EventPayload {
  const data = asRecord(payload.data);

  return asRecord(data.object);
}

function expandableId(
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

function stringValue(
  value: unknown,
): string | null {
  return typeof value === "string"
    ? value
    : null;
}

async function markProcessed(
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

async function findPaymentByIntent(
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

async function getCheckoutAttemptId(
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
          AND "status" IN ('PENDING', 'PROCESSING')
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
        AND "status" = 'PENDING'
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
      UPDATE "InventoryReservation"
      SET "status" = 'RELEASED'
      WHERE "attemptId" = $1
        AND "status" = 'HELD'
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

async function processPaymentIntentEvent(
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

async function processDisputeEvent(
  sql: SqlExecutor,
  event: ConnectPaymentEvent,
  object: EventPayload,
): Promise<void> {
  if (
    !event.type.startsWith(
      "charge.dispute.",
    ) ||
    !event.stripeAccountId
  ) {
    return;
  }

  const disputeId =
    stringValue(object.id);

  const chargeId =
    expandableId(object.charge);

  if (!disputeId || !chargeId) {
    return;
  }

  const paymentResult =
    await sql.query<{
      id: string;
      storeId: string;
    }>(
      `
        SELECT
          "id",
          "storeId"
        FROM "Payment"
        WHERE "stripeAccountId" = $1
          AND "chargeId" = $2
      `,
      [
        event.stripeAccountId,
        chargeId,
      ],
    );

  const payment =
    paymentResult.rows[0];

  if (!payment) {
    return;
  }

  const status =
    stringValue(object.status) ??
    "under_review";

  await sql.query(
    `
      INSERT INTO "PaymentDispute" (
        "storeId",
        "paymentId",
        "stripeDisputeId",
        "status"
      )
      VALUES ($1, $2, $3, $4)

      ON CONFLICT ("stripeDisputeId")
      DO UPDATE
      SET "status" = EXCLUDED."status"
    `,
    [
      payment.storeId,
      payment.id,
      disputeId,
      status,
    ],
  );
}

function refundStatus(
  eventType: string,
): "PENDING" | "SUCCEEDED" | "FAILED" {
  if (
    eventType ===
    "refund.succeeded"
  ) {
    return "SUCCEEDED";
  }

  if (
    eventType ===
    "refund.failed"
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
      refundStatus(event.type),
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

async function processRefundEvent(
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
    event.type ===
    "charge.refunded"
  ) {
    await processChargeRefunded(
      sql,
      payment,
    );
  }
}

export async function processConnectPaymentEvent(
  sql: SqlExecutor,
  event: ConnectPaymentEvent,
): Promise<void> {
  if (!event.stripeAccountId) {
    return;
  }

  const object =
    stripeObject(event.payload);

  await markProcessed(
    sql,
    event.id,
  );

  const handledPaymentIntent =
    await processPaymentIntentEvent(
      sql,
      event,
      object,
    );

  if (handledPaymentIntent) {
    return;
  }

  await processDisputeEvent(
    sql,
    event,
    object,
  );

  await processRefundEvent(
    sql,
    event,
    object,
  );
}
