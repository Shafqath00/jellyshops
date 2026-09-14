import { Router, type Request } from "express";
import { z } from "zod";
import { requireMerchant, requireStorePermission } from "../../auth/middleware.js";
import type { AuthProvider } from "../../auth/types.js";
import type { PublishStorefrontResult } from "./service.js";

export interface StorefrontPublicationApi {
  publish(
    storeId: string,
    expectedGeneration: number,
    idempotencyKey: string,
    actorUserId: number,
  ): Promise<PublishStorefrontResult | {
    ok: true;
    publication: { id: string; storeId: string; sourceGeneration: number };
    diagnostics: unknown[];
    reused: boolean;
  }>;
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

  return router;
}
