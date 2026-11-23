import { Router } from "express";
import { z } from "zod";
import { requireMerchant, requireStorePermission } from "../../auth/middleware.js";
import type { AuthProvider } from "../../auth/types.js";
import { ApiError } from "../../http/errors.js";
import type { StorefrontAccessService } from "./service.js";

const saveSchema = z.object({
  enabled: z.boolean().optional(),
  password: z.string().optional(),
  message: z.string().max(500).optional(),
}).strict();

const unlockSchema = z.object({ password: z.string().max(200) }).strict();

type Api = Pick<StorefrontAccessService, "getSettings" | "saveSettings" | "status" | "unlock">;

/** `GET/PUT /api/stores/:storeId/storefront/access`: the merchant's password settings. The hash is never returned. */
export function createMerchantAccessRouter(service: Api, authProvider: AuthProvider): Router {
  const router = Router({ mergeParams: true });
  router.get("/access", requireMerchant(authProvider), requireStorePermission("storefront:view"), async (request, response, next) => {
    try { response.json(await service.getSettings(request.storeContext!.storeId)); } catch (error) { next(error); }
  });
  router.put("/access", requireMerchant(authProvider), requireStorePermission("storefront:edit"), async (request, response, next) => {
    try { response.json(await service.saveSettings(request.storeContext!.storeId, saveSchema.parse(request.body ?? {}))); } catch (error) { next(error); }
  });
  return router;
}

/**
 * `GET .../access/status` (token in the `x-storefront-access` header) and `POST .../access/unlock`
 * for shoppers. Responses are never cached.
 */
export function createPublicAccessRouter(service: Api, isPaused?: (storeId: string) => Promise<boolean>): Router {
  const router = Router({ mergeParams: true });
  router.get<{ storeId: string }>("/status", async (request, response, next) => {
    try {
      const storeId = String(request.params.storeId);
      const status = await service.status(storeId, request.header("x-storefront-access"));
      // A paused shop (billing) shows a "temporarily unavailable" page; a failing lookup never closes a shop.
      const paused = isPaused ? await isPaused(storeId).catch(() => false) : false;
      response.set("Cache-Control", "no-store").json({ ...status, paused });
    } catch (error) { next(error); }
  });
  router.post<{ storeId: string }>("/unlock", async (request, response, next) => {
    try {
      const { password } = unlockSchema.parse(request.body ?? {});
      const token = await service.unlock(String(request.params.storeId), password, request.ip ?? "unknown");
      if (!token) throw new ApiError(401, "WRONG_PASSWORD", "That password isn't right.");
      response.set("Cache-Control", "no-store").json({ token });
    } catch (error) { next(error); }
  });
  return router;
}
