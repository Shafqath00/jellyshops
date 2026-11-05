import express, { Router, type Response } from "express";
import { z } from "zod";
import { requireMerchant, requireStorePermission } from "../../auth/middleware.js";
import type { AuthProvider } from "../../auth/types.js";
import { ApiError } from "../../http/errors.js";
import type { ThemePackageService } from "./service.js";

/** A package is JSON with its files inside as base64; the whole body stays under this size. */
export const THEME_PACKAGE_BODY_LIMIT = "8mb";

const installSchema = z.union([z.object({}).strict(), z.object({ replaceDraft: z.literal(true), expectedGeneration: z.number().int().nonnegative() }).strict()]);

/** The body is empty (first install) or confirms replacing the draft at the generation the merchant saw. */
function replace(body: z.infer<typeof installSchema>): { replaceDraft: boolean; expectedGeneration: number } | undefined {
  return "replaceDraft" in body && body.replaceDraft ? { replaceDraft: true, expectedGeneration: body.expectedGeneration } : undefined;
}

type MerchantApi = Pick<ThemePackageService, "upload" | "list" | "yank" | "install">;
type PublicApi = Pick<ThemePackageService, "getVersion" | "openAsset" | "openThemeAsset">;

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
  router.post("/theme-packages/versions/:versionId/install", requireMerchant(authProvider), requireStorePermission("storefront:edit"), async (request, response, next) => {
    try {
      const body = installSchema.safeParse(request.body ?? {});
      if (!body.success) throw new ApiError(422, "INSTALL_INPUT_INVALID", "Confirm replacing the draft with the current workspace generation.");
      response.status(201).json(await service.install(request.storeContext!.storeId, String(request.params.versionId), replace(body.data)));
    } catch (error) { next(error); }
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
      sendAsset(response, await service.openAsset(versionId, path), true);
    } catch (error) { next(error); }
  });
  // A theme's own file paths (`/themes/<id>/<file>` in theme.json), served on the store address by the
  // storefront. `?version=` pins a version; without it the newest available version answers.
  router.get(/^\/themes\/([a-z][a-z0-9-]{1,62})\/assets\/(.+)$/, async (request, response, next) => {
    try {
      const params = request.params as unknown as Record<string, string>;
      const version = typeof request.query.version === "string" ? request.query.version : undefined;
      sendAsset(response, await service.openThemeAsset(params["0"], params["1"], version), Boolean(version));
    } catch (error) { next(error); }
  });
  return router;
}

function sendAsset(response: Response, asset: { data: Buffer; contentType: string } | null, immutable: boolean): void {
  if (!asset) throw new ApiError(404, "NOT_FOUND", "That file was not found.");
  response.setHeader("content-type", asset.contentType);
  // A pinned version never changes; "the newest version" can, so it is cached briefly.
  response.setHeader("cache-control", immutable ? "public, max-age=31536000, immutable" : "public, max-age=300");
  response.setHeader("x-content-type-options", "nosniff");
  // An SVG opened on its own gets no way to run anything.
  response.setHeader("content-security-policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox");
  response.send(asset.data);
}
