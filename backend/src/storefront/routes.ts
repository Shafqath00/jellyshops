import { Router } from "express";
import { z } from "zod";
import { requireMerchant, requireStoreAccess } from "../auth/middleware.js";
import type { AuthProvider } from "../auth/types.js";
import { ApiError } from "../http/errors.js";
import type { StorefrontService } from "./service.js";

const revisionSchema = z.object({ expectedRevision: z.number().int().nonnegative().max(2_147_483_647) });

export function createStorefrontRouter(service: StorefrontService<unknown>, authProvider: AuthProvider): Router {
  const router = Router({ mergeParams: true });

  router.get<{ storeId: string }>("/public", async (request, response) => {
    const publication = await service.getPublic(String(request.params.storeId));
    if (!publication) throw new ApiError(404, "PUBLICATION_NOT_FOUND", "This store has not been published");
    response.json(publication);
  });

  router.use(requireMerchant(authProvider));

  router.get<{ storeId: string }>("/draft", requireStoreAccess("storefront:view"), async (request, response) => {
    response.json(await service.getOrCreateDraft(String(request.params.storeId)));
  });

  router.put<{ storeId: string }>("/draft", requireStoreAccess("storefront:edit"), async (request, response) => {
    const { expectedRevision } = revisionSchema.parse(request.body);
    response.json(await service.saveDraft(String(request.params.storeId), expectedRevision, request.body.document));
  });

  router.post<{ storeId: string }>("/publish", requireStoreAccess("storefront:publish"), async (request, response) => {
    const { expectedRevision } = revisionSchema.parse(request.body);
    response.status(201).json(await service.publish(String(request.params.storeId), expectedRevision));
  });

  return router;
}
