import { Router } from "express";
import { z } from "zod";
import { dynamicBindingSchema } from "@jelly/storefront-schema";
import { requireMerchant, requireStorePermission } from "../auth/middleware.js";
import type { AuthProvider } from "../auth/types.js";
import { bindingResourceTypes, MAX_BINDINGS_PER_REQUEST, type StorefrontBindingValueService } from "./binding-values.js";

const requestSchema = z.object({
  resource: z.object({ type: z.enum(bindingResourceTypes), id: z.string().min(1).max(200) }).strict().optional(),
  bindings: z.array(dynamicBindingSchema).max(MAX_BINDINGS_PER_REQUEST),
}).strict();

type BindingValuesApi = Pick<StorefrontBindingValueService, "resolve">;

/** `POST /api/public/stores/:storeId/storefront/binding-values`: values shoppers see. Drafts and hidden custom fields are never returned. */
export function createPublicBindingValuesRouter(service: BindingValuesApi): Router {
  const router = Router({ mergeParams: true });
  router.post<{ storeId: string }>("/", async (request, response, next) => {
    try {
      const body = requestSchema.parse(request.body ?? {});
      response.json({ values: await service.resolve(String(request.params.storeId), body, { includeDrafts: false }) });
    } catch (error) { next(error); }
  });
  return router;
}

/** `POST /api/stores/:storeId/storefront/binding-values`: the same values for the editor preview, which may show a draft product or page. */
export function createEditorBindingValuesRouter(service: BindingValuesApi, authProvider: AuthProvider): Router {
  const router = Router({ mergeParams: true });
  router.post("/binding-values", requireMerchant(authProvider), requireStorePermission("storefront:view"), async (request, response, next) => {
    try {
      const body = requestSchema.parse(request.body ?? {});
      response.json({ values: await service.resolve(request.storeContext!.storeId, body, { includeDrafts: true }) });
    } catch (error) { next(error); }
  });
  return router;
}
