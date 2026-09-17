import express from "express";
import { z } from "zod";

import { requireMerchant, requireStorePermission } from "../auth/middleware.js";
import type { AuthProvider } from "../auth/types.js";
import { ApiError } from "../http/errors.js";
import type { MerchantOrderService } from "./merchant-orders.js";

const fulfilmentSchema = z.object({
  status: z.string().min(1),
});

function getOrderId(req: express.Request): string {
  return String(req.params.orderId);
}

export function createMerchantOrderRouter(
  service: MerchantOrderService,
  auth: AuthProvider,
): express.Router {
  const router = express.Router({ mergeParams: true });

  router.use(requireMerchant(auth));

  router.get(
    "/",
    requireStorePermission("payments:view"),
    async (req, res, next) => {
      try {
        const storeId = req.storeContext!.storeId;
        const orders = await service.list(storeId);

        res.json({ orders });
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/:orderId",
    requireStorePermission("payments:view"),
    async (req, res, next) => {
      try {
        const storeId = req.storeContext!.storeId;
        const orderId = getOrderId(req);

        const order = await service.get(storeId, orderId);

        res.json(order);
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/:orderId/fulfilment",
    requireStorePermission("payments:manage"),
    async (req, res, next) => {
      try {
        const storeId = req.storeContext!.storeId;
        const orderId = getOrderId(req);

        const { status } = fulfilmentSchema.parse(req.body);

        const order = await service.transition(
          storeId,
          orderId,
          status,
        );

        res.json(order);
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/:orderId/refunds",
    requireStorePermission("orders:refund"),
    async (req, res, next) => {
      try {
        const storeId = req.storeContext!.storeId;
        const orderId = getOrderId(req);

        const hasBody =
          req.body &&
          Object.keys(req.body).length > 0;

        if (hasBody) {
          throw new ApiError(
            422,
            "FULL_REFUND_ONLY",
            "Only full refunds are supported.",
          );
        }

        const refund = await service.refund(
          storeId,
          orderId,
        );

        res.status(201).json(refund);
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}