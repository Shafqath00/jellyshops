import { Router } from "express";
import { requireMerchant, requireStorePermission } from "../auth/middleware.js";
import type { AuthProvider } from "../auth/types.js";
import { ApiError } from "../http/errors.js";
import type { StorefrontService } from "./service.js";

export function createStorefrontRouter(service: StorefrontService<unknown>, authProvider: AuthProvider): Router {
  const router = Router({ mergeParams: true });

  router.get<{ storeId: string }>("/public", async (request, response) => {
    const publication = await service.getPublic(String(request.params.storeId));
    if (!publication) throw new ApiError(404, "PUBLICATION_NOT_FOUND", "This store has not been published");
    response.json(publication);
  });

  router.use(requireMerchant(authProvider));

  // Legacy V3 migration compatibility only. New editor writes use normalized workspace routes.
  router.get<{ storeId: string }>("/draft", requireStorePermission("storefront:view"), async (request, response) => {
    response.json(await service.getOrCreateDraft(request.storeContext!.storeId));
  });

  return router;
}
