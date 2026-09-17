import { ApiError } from "../http/errors.js";
import type { CommerceRepository } from "./repository.js";

const fulfilmentTransitions: Record<string, string> = {
  PAID: "CONFIRMED",
  CONFIRMED: "PROCESSING",
  PROCESSING: "SHIPPED",
  SHIPPED: "DELIVERED",
};

const fulfilmentStartedStatuses = new Set([
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
]);

interface OrderRow {
  id: string;
  status: string;
}

interface PaymentRow {
  status: string;
}

export class FulfilmentService {
  constructor(private readonly repository: CommerceRepository) {}

  async transition(storeId: string, orderId: string, nextStatus: string) {
    return this.repository.transaction(async (tx) => {
      const orderResult = await tx.query<OrderRow>(
        `
          SELECT "id", "status"
          FROM "Order"
          WHERE "storeId" = $1
            AND "id" = $2
          FOR UPDATE
        `,
        [storeId, orderId],
      );

      const order = orderResult.rows[0];

      if (!order) {
        throw new ApiError(404, "ORDER_NOT_FOUND", "Order not found.");
      }

      // Repeating the same transition is safe.
      if (order.status === nextStatus) {
        return order;
      }

      const allowedNextStatus = fulfilmentTransitions[order.status];

      if (allowedNextStatus !== nextStatus) {
        throw new ApiError(
          409,
          "ORDER_TRANSITION_INVALID",
          "Order cannot move to that fulfilment state.",
        );
      }

      // PAID itself is already the authoritative payment-success state.
      // Later fulfilment transitions additionally verify the Payment row.
      if (nextStatus !== "CONFIRMED") {
        const paymentResult = await tx.query<PaymentRow>(
          `
            SELECT "status"
            FROM "Payment"
            WHERE "storeId" = $1
              AND "orderId" = $2
          `,
          [storeId, orderId],
        );

        const payment = paymentResult.rows[0];

        if (payment?.status !== "PAID") {
          throw new ApiError(
            409,
            "ORDER_NOT_PAID",
            "Payment must be authoritative before fulfilment.",
          );
        }
      }

      const fulfilmentStarted =
        fulfilmentStartedStatuses.has(nextStatus);

      const updateResult = await tx.query<OrderRow>(
        `
          UPDATE "Order"
          SET
            "status" = $3,
            "fulfilmentStartedAt" = CASE
              WHEN $4
                THEN COALESCE("fulfilmentStartedAt", CURRENT_TIMESTAMP)
              ELSE "fulfilmentStartedAt"
            END,
            "updatedAt" = CURRENT_TIMESTAMP
          WHERE "storeId" = $1
            AND "id" = $2
            AND "status" = $5
          RETURNING *
        `,
        [
          storeId,
          orderId,
          nextStatus,
          fulfilmentStarted,
          order.status,
        ],
      );

      // Another concurrent transition may have won.
      return updateResult.rows[0] ?? order;
    });
  }
}