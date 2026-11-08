import { Router } from "express";
import { z } from "zod";
import { requireMerchant, requireStorePermission } from "../../auth/middleware.js";
import type { AuthProvider } from "../../auth/types.js";
import type { ThemeUpgradeService } from "./upgrade-service.js";

const generationSchema = z.object({ expectedGeneration: z.number().int().nonnegative() }).strict();

/**
 * `/api/stores/:storeId/theme-upgrade`: what newer versions of the draft's uploaded theme exist,
 * what upgrading would change, the upgrade itself and undoing it. Merchants only (not developer
 * tokens): an upgrade rewrites the store's draft.
 */
export function createThemeUpgradeRouter(service: Pick<ThemeUpgradeService, "offer" | "preview" | "apply" | "rollback">, authProvider: AuthProvider): Router {
  const router = Router({ mergeParams: true });
  router.use("/theme-upgrade", requireMerchant(authProvider));
  router.get("/theme-upgrade", requireStorePermission("storefront:view"), async (request, response, next) => {
    try { response.json({ offer: await service.offer(request.storeContext!.storeId) }); } catch (error) { next(error); }
  });
  router.post("/theme-upgrade/:versionId/preview", requireStorePermission("storefront:edit"), async (request, response, next) => {
    try { response.json({ preview: await service.preview(request.storeContext!.storeId, String(request.params.versionId)) }); } catch (error) { next(error); }
  });
  router.post("/theme-upgrade/:versionId/apply", requireStorePermission("storefront:edit"), async (request, response, next) => {
    try {
      const { expectedGeneration } = generationSchema.parse(request.body ?? {});
      response.json(await service.apply(request.storeContext!.storeId, String(request.params.versionId), expectedGeneration, request.storeContext!.userId));
    } catch (error) { next(error); }
  });
  router.post("/theme-upgrade/rollback", requireStorePermission("storefront:edit"), async (request, response, next) => {
    try { response.json(await service.rollback(request.storeContext!.storeId, generationSchema.parse(request.body ?? {}).expectedGeneration)); } catch (error) { next(error); }
  });
  return router;
}
