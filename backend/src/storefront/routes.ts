import { Router } from "express";
import type { RuntimeStorefrontSnapshotV4 } from "@jelly/storefront-schema";
import {
  requireMerchant,
  requireStorePermission,
} from "../auth/middleware.js";
import type { AuthProvider } from "../auth/types.js";
import { ApiError } from "../http/errors.js";
import type { StorefrontService } from "./service.js";

export interface PublicStorefrontApi {
  load(storeId: string): Promise<{
    id: string;
    document: RuntimeStorefrontSnapshotV4;
  } | null>;
}

export function createStorefrontRouter(
  service: StorefrontService<unknown>,
  publicApi: PublicStorefrontApi,
  authProvider: AuthProvider,
): Router {
  const router = Router({ mergeParams: true });

  // Public storefront — deliberately anonymous.
  router.get<{ storeId: string }>(
    "/public",
    async (request, response) => {
      const storeId = String(request.params.storeId);

      const publication = await publicApi.load(storeId);

      if (!publication) {
        throw new ApiError(
          404,
          "PUBLICATION_NOT_FOUND",
          "This store has not been published",
        );
      }

      response.setHeader(
        "Cache-Control",
        "no-store, max-age=0",
      );

      response.json(publication);
    },
  );

  // Legacy V3 migration compatibility only.
  // Authentication applies only to this endpoint.
  router.get<{ storeId: string }>(
    "/draft",
    requireMerchant(authProvider),
    requireStorePermission("storefront:view"),
    async (request, response) => {
      response.json(
        await service.getOrCreateDraft(
          request.storeContext!.storeId,
        ),
      );
    },
  );

  return router;
}
