import express from "express";
import { z } from "zod";
import { requireMerchant, requireStorePermission } from "../auth/middleware.js";
import type { AuthProvider } from "../auth/types.js";
import type { MerchantOrderService } from "./merchant-orders.js";
import { ApiError } from "../http/errors.js";

export function createMerchantOrderRouter(service: MerchantOrderService, auth: AuthProvider): express.Router {
  const router = express.Router({ mergeParams: true });
  router.use(requireMerchant(auth));
  router.get("/", requireStorePermission("payments:view"), async (req, res, next) => { try { res.json({ orders: await service.list(req.storeContext!.storeId) }); } catch (e) { next(e); } });
  router.get("/:orderId", requireStorePermission("payments:view"), async (req, res, next) => { try { res.json(await service.get(req.storeContext!.storeId, String(req.params.orderId))); } catch (e) { next(e); } });
  router.post("/:orderId/fulfilment", requireStorePermission("payments:manage"), async (req, res, next) => { try { const nextState = z.object({ status: z.string().min(1) }).parse(req.body).status; res.json(await service.transition(req.storeContext!.storeId, String(req.params.orderId), nextState)); } catch (e) { next(e); } });
  router.post("/:orderId/refunds", requireStorePermission("orders:refund"), async (req, res, next) => { try { if (Object.keys(req.body ?? {}).length > 0) throw new ApiError(422, "FULL_REFUND_ONLY", "Only full refunds are supported."); res.status(201).json(await service.refund(req.storeContext!.storeId, String(req.params.orderId))); } catch (e) { next(e); } });
  return router;
}
