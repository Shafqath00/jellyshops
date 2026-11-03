import express, { Router } from "express";
import { requireMerchant, requireStorePermission } from "../../auth/middleware.js";
import type { AuthProvider } from "../../auth/types.js";
import { ApiError } from "../../http/errors.js";
import type { ThemePackageService } from "./service.js";

/** A package is JSON with its files inside as base64; the whole body stays under this size. */
export const THEME_PACKAGE_BODY_LIMIT = "8mb";

type MerchantApi = Pick<ThemePackageService, "upload" | "list" | "yank">;
type PublicApi = Pick<ThemePackageService, "getVersion" | "openAsset">;

/** True for the one request that carries a theme package, so the app-wide 2 MB body limit can step aside for it. */
export function isThemePackageUpload(request: { method: string; path: string }): boolean {
  return request.method === "POST" && /^\/api\/stores\/[^/]+\/theme-packages\/?$/.test(request.path);
}

/** `/api/stores/:storeId/theme-packages`: upload, list and yank the store's own themes. */
export function createThemePackageRouter(service: MerchantApi, authProvider: AuthProvider): Router {
  const router = Router({ mergeParams: true });
  router.post("/theme-packages", express.json({ limit: THEME_PACKAGE_BODY_LIMIT }), requireMerchant(authProvider), requireStorePermission("storefront:edit"), async (request, response, next) => {
    try {
      const result = await service.upload(request.storeContext!.storeId, request.body);
      response.status(result.created ? 201 : 200).json(result);
    } catch (error) { next(error); }
  });
  router.get("/theme-packages", requireMerchant(authProvider), requireStorePermission("storefront:view"), async (request, response, next) => {
    try { response.json({ packages: await service.list(request.storeContext!.storeId) }); } catch (error) { next(error); }
  });
  router.post("/theme-packages/versions/:versionId/yank", requireMerchant(authProvider), requireStorePermission("storefront:edit"), async (request, response, next) => {
    try { await service.yank(request.storeContext!.storeId, String(request.params.versionId)); response.status(204).end(); } catch (error) { next(error); }
  });
  return router;
}

/**
 * `/api/public/theme-versions/:versionId`: what a storefront loads to draw an uploaded theme.
 * Versions never change, so both routes can be cached for good.
 */
export function createPublicThemeVersionRouter(service: PublicApi): Router {
  const router = Router();
  router.get("/theme-versions/:versionId", async (request, response, next) => {
    try {
      const version = await service.getVersion(String(request.params.versionId));
      if (!version) throw new ApiError(404, "NOT_FOUND", "That theme version was not found.");
      response.setHeader("cache-control", "public, max-age=31536000, immutable");
      response.json({ version });
    } catch (error) { next(error); }
  });
  router.get(/^\/theme-versions\/([^/]+)\/assets\/(.+)$/, async (request, response, next) => {
    try {
      const params = request.params as unknown as Record<string, string>;
      const versionId = params["0"];
      const path = params["1"];
      const asset = await service.openAsset(versionId, path);
      if (!asset) throw new ApiError(404, "NOT_FOUND", "That file was not found.");
      response.setHeader("content-type", asset.contentType);
      response.setHeader("cache-control", "public, max-age=31536000, immutable");
      response.setHeader("x-content-type-options", "nosniff");
      // An SVG opened on its own gets no way to run anything.
      response.setHeader("content-security-policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox");
      response.send(asset.data);
    } catch (error) { next(error); }
  });
  return router;
}
