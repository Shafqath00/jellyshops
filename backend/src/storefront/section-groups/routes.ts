import { Router } from "express";
import { z } from "zod";
import { requireMerchant, requireStorePermission } from "../../auth/middleware.js";
import type { AuthProvider } from "../../auth/types.js";
import type { SectionGroupService } from "./service.js";

const saveSchema = z.object({
  groups: z.unknown(),
  expectedGeneration: z.number().int().nonnegative().optional(),
}).strict();

/**
 * `/api/stores/:storeId/storefront/section-groups`: the store's shared header, footer and overlay sections (theme
 * plan T6). GET returns the saved groups, or the ones the templates imply; PUT saves them to the draft.
 */
export function createSectionGroupsRouter(service: Pick<SectionGroupService, "read" | "save">, authProvider: AuthProvider): Router {
  const router = Router({ mergeParams: true });
  router.use("/storefront/section-groups", requireMerchant(authProvider));
  router.get("/storefront/section-groups", requireStorePermission("storefront:view"), async (request, response, next) => {
    try { response.json(await service.read(request.storeContext!.storeId)); } catch (error) { next(error); }
  });
  router.put("/storefront/section-groups", requireStorePermission("storefront:edit"), async (request, response, next) => {
    try {
      const input = saveSchema.parse(request.body ?? {});
      response.json(await service.save(request.storeContext!.storeId, input.groups, input.expectedGeneration));
    } catch (error) { next(error); }
  });
  return router;
}
