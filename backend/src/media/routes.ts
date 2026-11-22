import { Router } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import multer from "multer";
import { requireMerchant, requireStorePermission } from "../auth/middleware.js";
import type { AuthProvider } from "../auth/types.js";
import { ApiError } from "../http/errors.js";
import { MEDIA_WIDTHS, type MediaService } from "./service.js";

export function createMediaRouter(service: MediaService, authProvider: AuthProvider, maxUploadBytes: number): Router {
  const router = Router({ mergeParams: true });
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: maxUploadBytes, files: 1 } });
  // The Firebase emulator on Windows can leave request.ip undefined; fall back
  // to a shared bucket instead of failing the request.
  const uploadLimit = rateLimit({
    windowMs: 60_000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (request) => (request.ip ? ipKeyGenerator(request.ip) : "unknown"),
  });

  router.use(requireMerchant(authProvider));
  router.post<{ storeId: string }>("/", requireStorePermission("media:upload"), uploadLimit, upload.single("file"), async (request, response) => {
    if (!request.file) throw new ApiError(400, "MEDIA_REQUIRED", "Choose an image to upload");
    response.status(201).json(await service.upload(request.storeContext!.storeId, request.file));
  });

  router.get<{ storeId: string }>("/", requireStorePermission("storefront:view"), async (request, response) => {
    response.json(await service.list(request.storeContext!.storeId, request.query.unused === "older30d"));
  });

  router.delete<{ storeId: string; mediaId: string }>("/:mediaId", requireStorePermission("media:delete"), async (request, response) => {
    await service.remove(request.storeContext!.storeId, request.params.mediaId);
    response.sendStatus(204);
  });

  return router;
}

export function createPublicMediaRouter(service: MediaService): Router {
  const router = Router();
  router.get<{ storeId: string; mediaId: string }>("/:storeId/:mediaId", async (request, response) => {
    const requestedWidth = request.query.w;
    if (requestedWidth !== undefined && (typeof requestedWidth !== "string" || !MEDIA_WIDTHS.some(width => String(width) === requestedWidth))) {
      throw new ApiError(400, "MEDIA_WIDTH_INVALID", `Choose a supported image width: ${MEDIA_WIDTHS.join(", ")}`);
    }
    const width = requestedWidth === undefined ? undefined : Number(requestedWidth);
    // With a public photo domain, the old API address only points there: permanently, so browsers and caches remember.
    const location = await service.publicLocation(request.params.storeId, request.params.mediaId, width);
    if (location) { response.set("Cache-Control", "public, max-age=31536000, immutable").redirect(301, location); return; }
    const media = await service.open(request.params.storeId, request.params.mediaId, width);
    // Files never change (a new photo gets a new id), so browsers and CDNs may keep them for a year.
    response.set("Cache-Control", "public, max-age=31536000, s-maxage=31536000, immutable").set("ETag", media.etag).type(media.mimeType).send(media.contents);
  });
  return router;
}
