import { ApiError } from "../http/errors.js";
import type { StripeGateway } from "../stripe/client.js";

import { FulfilmentService } from "./fulfilment.js";
import type { CommerceRepository } from "./repository.js";
import { OrderManagementService } from "./order-management.js";
import { RefundService } from "./refunds.js";

export class MerchantOrderService {
  readonly management: OrderManagementService;
  private readonly fulfilment: FulfilmentService;
  private readonly refunds: RefundService;

  constructor(
    private readonly repository: CommerceRepository,
    stripe: StripeGateway,
  ) {
    this.management = new OrderManagementService(repository, stripe);
    this.fulfilment = new FulfilmentService(repository);
    this.refunds = new RefundService(repository, stripe);
  }

  search(storeId: string, query: import("./order-management.js").OrderQuery) { return this.management.search(storeId, query); }

  async list(storeId: string) {
    return this.repository.transaction(async (tx) => {
      const result = await tx.query(
        `
          SELECT
            o.*,
            p."status" AS "paymentStatus",
            p."paymentIntentId",
            p."chargeId"
          FROM "Order" o
          LEFT JOIN "Payment" p
            ON p."orderId" = o."id"
            AND p."storeId" = o."storeId"
          WHERE o."storeId" = $1
          ORDER BY o."createdAt" DESC
        `,
        [storeId],
      );

      return result.rows;
    });
  }

  async get(storeId: string, orderId: string): Promise<Record<string, any>> {
    const detail = await this.repository.transaction(async (tx) => {
      const orderResult = await tx.query(
        `
          SELECT *
          FROM "Order"
          WHERE "storeId" = $1
            AND "id" = $2
        `,
        [storeId, orderId],
      );

      const order = orderResult.rows[0];

      if (!order) {
        throw new ApiError(
          404,
          "ORDER_NOT_FOUND",
          "Order not found.",
        );
      }

      const itemsResult = await tx.query(
        `
          SELECT *
          FROM "OrderItem"
          WHERE "storeId" = $1
            AND "orderId" = $2
          ORDER BY "variantId"
        `,
        [storeId, orderId],
      );

      const paymentResult = await tx.query(
        `
          SELECT *
          FROM "Payment"
          WHERE "storeId" = $1
            AND "orderId" = $2
        `,
        [storeId, orderId],
      );

      const payment = paymentResult.rows[0] ?? null;

      const refundsResult = await tx.query(
        `
          SELECT *
          FROM "Refund"
          WHERE "storeId" = $1
            AND "orderId" = $2
          ORDER BY "id"
        `,
        [storeId, orderId],
      );

      let disputes: any[] = [];

      if (payment) {
        const disputesResult = await tx.query(
          `
            SELECT *
            FROM "PaymentDispute"
            WHERE "storeId" = $1
              AND "paymentId" = $2
          `,
          [storeId, payment.id],
        );

        disputes = disputesResult.rows;
      }

      return {
        ...await this.management.details(storeId, orderId, tx),
        order,
        items: itemsResult.rows,
        payment,
        refunds: refundsResult.rows,
        disputes,
      };
    });
    return detail;
  }

  transition(
    storeId: string,
    orderId: string,
    nextStatus: string,
  ) {
    return this.fulfilment.transition(
      storeId,
      orderId,
      nextStatus,
    );
  }

  async refund(storeId: string, orderId: string) {
    const order = await this.repository.transaction(async tx =>
      (await tx.query(`SELECT revision FROM "Order" WHERE "storeId"=$1 AND id=$2`, [storeId, orderId])).rows[0]);
    if (!order) throw new ApiError(404, "ORDER_NOT_FOUND", "Order not found.");
    return this.management.refund(storeId, orderId, { revision: Number(order.revision), idempotencyKey: `legacy-full-${orderId}` });
  }
}


