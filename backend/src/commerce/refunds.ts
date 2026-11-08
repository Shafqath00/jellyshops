import { randomUUID } from "node:crypto";

import { ApiError } from "../http/errors.js";
import type { StripeGateway } from "../stripe/client.js";
import type { CommerceRepository } from "./repository.js";

interface RefundableOrder {
  id: string;
  status: string;
}

interface RefundablePayment {
  id: string;
  status: string;
  amountMinor: number;
  paymentIntentId: string;
  stripeAccountId: string;
}

function notRefundableError() {
  return new ApiError(
    409,
    "ORDER_NOT_REFUNDABLE",
    "Order is not eligible for a full refund.",
  );
}

export class RefundService {
  constructor(
    private readonly repository: CommerceRepository,
    private readonly stripe: StripeGateway,
  ) {}

  async fullRefund(storeId: string, orderId: string) {
    return this.repository.transaction(async (tx) => {
      const orderResult = await tx.query<RefundableOrder>(
        `
          SELECT *
          FROM "Order"
          WHERE "storeId" = $1
            AND "id" = $2
          FOR UPDATE
        `,
        [storeId, orderId],
      );

      const paymentResult = await tx.query<RefundablePayment>(
        `
          SELECT *
          FROM "Payment"
          WHERE "storeId" = $1
            AND "orderId" = $2
          FOR UPDATE
        `,
        [storeId, orderId],
      );

      const order = orderResult.rows[0];
      const payment = paymentResult.rows[0];

      const refundable =
        order &&
        payment &&
        payment.status === "PAID" &&
        ["PAID", "CONFIRMED"].includes(order.status);

      if (!refundable) {
        throw notRefundableError();
      }

      const existingRefundResult = await tx.query(
        `
          SELECT *
          FROM "Refund"
          WHERE "storeId" = $1
            AND "orderId" = $2
          ORDER BY "id"
          LIMIT 1
        `,
        [storeId, orderId],
      );

      const existingRefund = existingRefundResult.rows[0];

      if (existingRefund) {
        return existingRefund;
      }

      const refundId = `refund-${randomUUID()}`;
      const idempotencyKey = `refund-${refundId}`;

      const insertedRefundResult = await tx.query(
        `
          INSERT INTO "Refund" (
            "id",
            "storeId",
            "orderId",
            "paymentId",
            "amountMinor",
            "status",
            "stripeIdempotencyKey"
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            'PENDING',
            $6
          )
          RETURNING *
        `,
        [
          refundId,
          storeId,
          orderId,
          payment.id,
          payment.amountMinor,
          idempotencyKey,
        ],
      );

      const refund = insertedRefundResult.rows[0];

      const stripeRefund = await this.stripe.createFullRefund(
        {
          paymentIntentId: payment.paymentIntentId,
          orderId,
          refundId,
        },
        {
          connectedAccountId: payment.stripeAccountId,
          idempotencyKey,
        },
      );

      await tx.query(
        `
          UPDATE "Refund"
          SET "stripeRefundId" = $2
          WHERE "id" = $1
        `,
        [refundId, stripeRefund.id],
      );

      return refund;
    });
  }
}