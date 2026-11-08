import { Router } from "express";
import { z } from "zod";
import { themeVersionSchema } from "@jelly/storefront-schema";
import { requireMerchant, requireStorePermission } from "../../auth/middleware.js";
import type { AuthProvider } from "../../auth/types.js";
import type { ThemeLibraryService } from "./service.js";

const saveSchema = z.object({
  name: z.string(),
  themeId: z.string().min(1).max(100),
  themeVersion: themeVersionSchema.optional(),
  settings: z.record(z.string(), z.unknown()),
}).strict();
const renameSchema = z.object({ name: z.string() }).strict();

type Api = Pick<ThemeLibraryService, "list" | "save" | "rename" | "remove">;

/** `/api/stores/:storeId/storefront/theme-library`: the merchant's saved looks. */
export function createThemeLibraryRouter(service: Api, authProvider: AuthProvider): Router {
  const router = Router({ mergeParams: true });
  const base = "/theme-library";
  router.get(base, requireMerchant(authProvider), requireStorePermission("storefront:view"), async (request, response, next) => {
    try { response.json({ looks: await service.list(request.storeContext!.storeId) }); } catch (error) { next(error); }
  });
  router.post(base, requireMerchant(authProvider), requireStorePermission("storefront:edit"), async (request, response, next) => {
    try { response.status(201).json({ look: await service.save(request.storeContext!.storeId, saveSchema.parse(request.body ?? {})) }); } catch (error) { next(error); }
  });
  router.patch(`${base}/:lookId`, requireMerchant(authProvider), requireStorePermission("storefront:edit"), async (request, response, next) => {
    try { response.json({ look: await service.rename(request.storeContext!.storeId, String(request.params.lookId), renameSchema.parse(request.body ?? {}).name) }); } catch (error) { next(error); }
  });
  router.delete(`${base}/:lookId`, requireMerchant(authProvider), requireStorePermission("storefront:edit"), async (request, response, next) => {
    try { await service.remove(request.storeContext!.storeId, String(request.params.lookId)); response.status(204).end(); } catch (error) { next(error); }
  });
  return router;
}
