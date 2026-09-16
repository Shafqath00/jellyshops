import { ApiError } from "../http/errors.js";
import type { CommerceRepository } from "./repository.js";
import { FulfilmentService } from "./fulfilment.js";
import { RefundService } from "./refunds.js";
import type { StripeGateway } from "../stripe/client.js";

export class MerchantOrderService {
  private readonly fulfilment: FulfilmentService;
  private readonly refunds: RefundService;
  constructor(private readonly repository: CommerceRepository, stripe: StripeGateway) {
    this.fulfilment = new FulfilmentService(repository);
    this.refunds = new RefundService(repository, stripe);
  }
  async list(storeId: string) {
    return this.repository.transaction(async (tx) => (await tx.query(`SELECT o.*, p."status" AS "paymentStatus", p."paymentIntentId", p."chargeId" FROM "Order" o LEFT JOIN "Payment" p ON p."orderId"=o."id" AND p."storeId"=o."storeId" WHERE o."storeId"=$1 ORDER BY o."createdAt" DESC`, [storeId])).rows);
  }
  async get(storeId: string, orderId: string) {
    return this.repository.transaction(async (tx) => {
      const order = (await tx.query(`SELECT * FROM "Order" WHERE "storeId"=$1 AND "id"=$2`, [storeId, orderId])).rows[0];
      if (!order) throw new ApiError(404, "ORDER_NOT_FOUND", "Order not found.");
      const items = (await tx.query(`SELECT * FROM "OrderItem" WHERE "storeId"=$1 AND "orderId"=$2 ORDER BY "variantId"`, [storeId, orderId])).rows;
      const payment = (await tx.query(`SELECT * FROM "Payment" WHERE "storeId"=$1 AND "orderId"=$2`, [storeId, orderId])).rows[0] ?? null;
      const refunds = (await tx.query(`SELECT * FROM "Refund" WHERE "storeId"=$1 AND "orderId"=$2 ORDER BY "id"`, [storeId, orderId])).rows;
      const disputes = payment ? (await tx.query(`SELECT * FROM "PaymentDispute" WHERE "storeId"=$1 AND "paymentId"=$2`, [storeId, payment.id])).rows : [];
      return { order, items, payment, refunds, disputes };
    });
  }
  transition(storeId: string, orderId: string, next: string) { return this.fulfilment.transition(storeId, orderId, next); }
  refund(storeId: string, orderId: string) { return this.refunds.fullRefund(storeId, orderId); }
}
