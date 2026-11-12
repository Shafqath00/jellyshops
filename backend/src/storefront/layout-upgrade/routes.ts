import { Router } from "express";
import { z } from "zod";
import { requireMerchant, requireStorePermission } from "../../auth/middleware.js";
import type { AuthProvider } from "../../auth/types.js";
import type { LayoutUpgradeService } from "./service.js";

const generationSchema = z.object({ expectedGeneration: z.number().int().nonnegative() }).strict();

/**
 * `/api/stores/:storeId/storefront/layout-upgrade`: whether the draft is on an earlier page layout of its
 * theme, what moving to the current layout would change, the upgrade itself and undoing it. Merchants
 * only: an upgrade rewrites the store's draft.
 */
export function createLayoutUpgradeRouter(service: Pick<LayoutUpgradeService, "offer" | "preview" | "apply" | "rollback">, authProvider: AuthProvider): Router {
  const router = Router({ mergeParams: true });
  router.use("/storefront/layout-upgrade", requireMerchant(authProvider));
  router.get("/storefront/layout-upgrade", requireStorePermission("storefront:view"), async (request, response, next) => {
    try { response.json({ offer: await service.offer(request.storeContext!.storeId) }); } catch (error) { next(error); }
  });
  router.post("/storefront/layout-upgrade/preview", requireStorePermission("storefront:edit"), async (request, response, next) => {
    try { response.json({ preview: await service.preview(request.storeContext!.storeId) }); } catch (error) { next(error); }
  });
  router.post("/storefront/layout-upgrade/apply", requireStorePermission("storefront:edit"), async (request, response, next) => {
    try {
      const { expectedGeneration } = generationSchema.parse(request.body ?? {});
      response.json(await service.apply(request.storeContext!.storeId, expectedGeneration, request.storeContext!.userId));
    } catch (error) { next(error); }
  });
  router.post("/storefront/layout-upgrade/rollback", requireStorePermission("storefront:edit"), async (request, response, next) => {
    try { response.json(await service.rollback(request.storeContext!.storeId, generationSchema.parse(request.body ?? {}).expectedGeneration)); } catch (error) { next(error); }
  });
  return router;
}
