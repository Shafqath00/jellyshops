import { ApiError } from "../http/errors.js";
import type { CommerceRepository } from "./repository.js";

const transitions: Record<string, string[]> = {
  PAID: ["CONFIRMED"], CONFIRMED: ["PROCESSING"], PROCESSING: ["SHIPPED"], SHIPPED: ["DELIVERED"],
};

export class FulfilmentService {
  constructor(private readonly repository: CommerceRepository) {}
  async transition(storeId: string, orderId: string, next: string) {
    return this.repository.transaction(async (tx) => {
      const current = (await tx.query<any>(`SELECT "status" FROM "Order" WHERE "storeId"=$1 AND "id"=$2 FOR UPDATE`, [storeId, orderId])).rows[0];
      if (!current) throw new ApiError(404, "ORDER_NOT_FOUND", "Order not found.");
      if (current.status === next) return current;
      if (!transitions[current.status]?.includes(next)) throw new ApiError(409, "ORDER_TRANSITION_INVALID", "Order cannot move to that fulfilment state.");
      const payment = (await tx.query<any>(`SELECT "status" FROM "Payment" WHERE "storeId"=$1 AND "orderId"=$2`, [storeId, orderId])).rows[0];
      if (next !== "CONFIRMED" && payment?.status !== "PAID") throw new ApiError(409, "ORDER_NOT_PAID", "Payment must be authoritative before fulfilment.");
      const started = ["PROCESSING", "SHIPPED", "DELIVERED"].includes(next);
      const result = (await tx.query<any>(`UPDATE "Order" SET "status"=$3, "fulfilmentStartedAt"=CASE WHEN $4 THEN COALESCE("fulfilmentStartedAt", CURRENT_TIMESTAMP) ELSE "fulfilmentStartedAt" END, "updatedAt"=CURRENT_TIMESTAMP WHERE "storeId"=$1 AND "id"=$2 AND "status"=$5 RETURNING *`, [storeId, orderId, next, started, current.status])).rows[0];
      return result ?? current;
    });
  }
}
