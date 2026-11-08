import { Router } from "express";
import { z } from "zod";
import { requireMerchant, requireStorePermission } from "../auth/middleware.js";
import type { AuthProvider } from "../auth/types.js";
import type { BackInStockService } from "./service.js";

type Api = Pick<BackInStockService, "request" | "waitingCounts">;

const requestSchema = z.object({
  variantId: z.string().min(1).max(200),
  email: z.string().max(254),
  // Left empty by people; bots that fill every field are quietly ignored.
  website: z.string().max(200).optional(),
}).strict();

/** `POST /api/public/stores/:storeId/back-in-stock`: a shopper asks to hear when a sold-out variant returns. */
export function createPublicBackInStockRouter(service: Api): Router {
  const router = Router({ mergeParams: true });
  router.post<{ storeId: string }>("/", async (request, response, next) => {
    try {
      const input = requestSchema.parse(request.body ?? {});
      response.set("Cache-Control", "no-store");
      if (input.website) { response.status(202).json({ status: "waiting" }); return; }
      response.status(202).json(await service.request(String(request.params.storeId), input.variantId, input.email, request.ip ?? "unknown"));
    } catch (error) { next(error); }
  });
  return router;
}

/** `GET /api/stores/:storeId/back-in-stock`: how many shoppers wait for each variant. */
export function createMerchantBackInStockRouter(service: Api, authProvider: AuthProvider): Router {
  const router = Router({ mergeParams: true });
  router.get("/", requireMerchant(authProvider), requireStorePermission("catalog:view"), async (request, response, next) => {
    try { response.json({ variants: await service.waitingCounts(request.storeContext!.storeId) }); } catch (error) { next(error); }
  });
  return router;
}
