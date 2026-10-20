import { Router, type Request } from "express";
import { z } from "zod";
import { requireMerchant, requireStorePermission } from "../../auth/middleware.js";
import type { AuthProvider } from "../../auth/types.js";
import { ApiError } from "../../http/errors.js";
import type { StarterInstallationResult } from "./installation-service.js";

export interface StorefrontStarterApi {
  install(storeId: string, starterPackId: string, options?: { replaceDraft: boolean; expectedGeneration: number }): Promise<StarterInstallationResult>;
}

export function createStorefrontStarterRouter(api: StorefrontStarterApi, authProvider: AuthProvider): Router {
  const router = Router({ mergeParams: true });
  router.use(requireMerchant(authProvider));
  router.post("/:starterId/install", requireStorePermission("storefront:edit"), async (request: Request, response, next) => {
    try {
      const starterId = String(request.params.starterId);
      if (starterId !== "fresh-market" && starterId !== "artisan-boutique" && starterId !== "jelly-signature") {
        throw new ApiError(400, "STARTER_UNKNOWN", "The selected starter pack does not exist");
      }
      const parsed = z.object({ replaceDraft: z.literal(true), expectedGeneration: z.number().int().nonnegative() }).strict().safeParse(request.body);
      if (request.body && Object.keys(request.body).length && !parsed.success) throw new ApiError(422, "STARTER_INPUT_INVALID", "Confirm draft replacement using the current workspace generation.");
      response.status(201).json(parsed.success ? await api.install(request.storeContext!.storeId, starterId, parsed.data) : await api.install(request.storeContext!.storeId, starterId));
    } catch (error) { next(error); }
  });
  return router;
}
