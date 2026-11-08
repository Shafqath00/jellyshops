import type { SqlExecutor } from "../../commerce/repository.js";

import type { EventPayload, ConnectPaymentEvent } from "./event-types.js";
import { expandableId, stringValue } from "./event-helpers.js";

export async function processDisputeEvent(
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
