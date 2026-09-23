import { Router, type Request } from "express";
import { requireMerchant, requireStorePermission } from "../../auth/middleware.js";
import type { AuthProvider } from "../../auth/types.js";
import { ApiError } from "../../http/errors.js";
import type { StarterInstallationResult } from "./installation-service.js";

export interface StorefrontStarterApi {
  install(storeId: string, starterPackId: string): Promise<StarterInstallationResult>;
}

export function createStorefrontStarterRouter(api: StorefrontStarterApi, authProvider: AuthProvider): Router {
  const router = Router({ mergeParams: true });
  router.use(requireMerchant(authProvider));
  router.post("/:starterId/install", requireStorePermission("storefront:edit"), async (request: Request, response, next) => {
    try {
      const starterId = String(request.params.starterId);
      if (starterId !== "fresh-market" && starterId !== "artisan-boutique") {
        throw new ApiError(400, "STARTER_UNKNOWN", "The selected starter pack does not exist");
      }
      response.status(201).json(await api.install(request.storeContext!.storeId, starterId));
    } catch (error) { next(error); }
  });
  return router;
}
