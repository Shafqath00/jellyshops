import { Router, type Request } from "express";
import { z } from "zod";
import { requireMerchant, requireStorePermission } from "../../auth/middleware.js";
import type { AuthProvider } from "../../auth/types.js";
import { ApiError } from "../../http/errors.js";
import type { PublicationHistoryEntry } from "./repository.js";
import type { PublishStorefrontResult } from "./service.js";

export interface StorefrontPublicationApi {
  publish(
    storeId: string,
    expectedGeneration: number,
    idempotencyKey: string,
    actorUserId: string,
  ): Promise<PublishStorefrontResult | {
    ok: true;
    publication: { id: string; storeId: string; sourceGeneration: number };
    diagnostics: unknown[];
    reused: boolean;
  }>;
  history?(storeId: string, limit?: number): Promise<PublicationHistoryEntry[]>;
  restore?(storeId: string, publicationId: string): Promise<{ id: string; sourceGeneration: number; alreadyCurrent: boolean }>;
}

const publishRequestSchema = z.object({
  expectedGeneration: z.number().int().nonnegative().max(2_147_483_647),
  idempotencyKey: z.string().trim().min(1).max(128),
}).strict();

function storeContext(request: Request) {
  return request.storeContext!;
}

export function createStorefrontPublicationRouter(api: StorefrontPublicationApi, authProvider: AuthProvider): Router {
  const router = Router({ mergeParams: true });
  router.use(requireMerchant(authProvider));

  router.post("/publish", requireStorePermission("storefront:publish"), async (request, response, next) => {
    try {
      const input = publishRequestSchema.parse(request.body);
      const context = storeContext(request);
      const result = await api.publish(
        context.storeId,
        input.expectedGeneration,
        input.idempotencyKey,
        context.userId,
      );

      if (!result.ok) {
        response.status(422).json(result);
        return;
      }
      response.status(result.reused ? 200 : 201).json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get("/publications", requireStorePermission("storefront:publish"), async (request, response, next) => {
    try {
      if (!api.history) throw new ApiError(503, "PUBLICATION_HISTORY_NOT_CONFIGURED", "Publish history is not available.");
      const publications = await api.history(storeContext(request).storeId, 20);
      response.json({ publications });
    } catch (error) {
      next(error);
    }
  });

  router.post("/publications/:publicationId/restore", requireStorePermission("storefront:publish"), async (request, response, next) => {
    try {
      if (!api.restore) throw new ApiError(503, "PUBLICATION_HISTORY_NOT_CONFIGURED", "Publish history is not available.");
      const publicationId = z.string().trim().min(1).max(128).parse(request.params.publicationId);
      const restored = await api.restore(storeContext(request).storeId, publicationId);
      response.json({ ok: true, publication: restored });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
