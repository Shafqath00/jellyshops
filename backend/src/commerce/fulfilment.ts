import { ApiError } from "../http/errors.js";
import type { CommerceRepository } from "./repository.js";
import { appendOrderEvent } from "./order-management.js";
import { randomUUID } from "node:crypto";

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
  balanceDueMinor?: number;
  fulfilmentStatus?: string;
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
          SELECT *
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

      {
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

        const pending = await tx.query(`SELECT id FROM "OrderRevision" WHERE "storeId"=$1 AND "orderId"=$2 AND status='PENDING'`, [storeId, orderId]);
        if (payment?.status !== "PAID" || (order.balanceDueMinor ?? 0) > 0 || pending.rows.length > 0) {
          throw new ApiError(
            409,
            "ORDER_NOT_PAID",
            "Payment must be authoritative before fulfilment.",
          );
        }
      }

      const fulfilmentStarted =
        fulfilmentStartedStatuses.has(nextStatus);

      if (nextStatus === "PROCESSING" || nextStatus === "SHIPPED") {
        const physical = await tx.query(`SELECT "variantId", "configurationKey", quantity FROM "OrderItem" WHERE "storeId"=$1 AND "orderId"=$2 AND "fulfillmentType"='PHYSICAL'`, [storeId, orderId]);
        if (!physical.rows.length) {
          throw new ApiError(409, "DIGITAL_FULFILMENT_AUTOMATIC", "Digital items are delivered automatically after payment.");
        }
        if (nextStatus === "SHIPPED") {
          await tx.query(`INSERT INTO "OrderFulfilment" (id,"storeId","orderId",items) VALUES ($1,$2,$3,$4)`, [`shipment-${randomUUID()}`, storeId, orderId, JSON.stringify(physical.rows)]);
        }
      }
      if (nextStatus === "DELIVERED") {
        if (order.fulfilmentStatus !== "FULFILLED") {
          throw new ApiError(409, "ORDER_PARTIALLY_FULFILLED", "Ship every physical item before marking the whole order delivered.");
        }
        await tx.query(`UPDATE "OrderFulfilment" SET status='DELIVERED',"deliveredAt"=COALESCE("deliveredAt",now()) WHERE "storeId"=$1 AND "orderId"=$2`, [storeId, orderId]);
      }

      const updateResult = await tx.query<OrderRow>(
        `
          UPDATE "Order"
          SET
            "status" = $3,
            "revision" = "revision" + 1,
            "fulfilmentStatus" = CASE WHEN $3='SHIPPED' THEN 'FULFILLED' WHEN $3='DELIVERED' THEN 'DELIVERED' ELSE "fulfilmentStatus" END,
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

      await appendOrderEvent(tx, storeId, orderId, "STATUS_CHANGED", { previousStatus: order.status, status: nextStatus });

      // Another concurrent transition may have won.
      return updateResult.rows[0] ?? order;
    });
  }
}
