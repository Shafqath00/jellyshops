import { Router, type RequestHandler } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import multer from "multer";
import { requireMerchant, requireStorePermission } from "../auth/middleware.js";
import type { AuthProvider } from "../auth/types.js";
import { MULTIPART_OVERHEAD_BYTES } from "../billing/limits-config.js";
import { fileTooLarge, type PlanLimitChecker } from "../billing/plan-limits.js";
import type { UploadRules } from "../billing/plans.js";
import { ApiError } from "../http/errors.js";
import { MEDIA_WIDTHS, type MediaService } from "./service.js";

/** Uploads a minute for a store without plan rules (exempt shops, or no billing on this server). */
const UNPLANNED_UPLOADS_PER_MINUTE = 60;

export function createMediaRouter(
  service: MediaService,
  authProvider: AuthProvider,
  maxUploadBytes: number,
  plans?: Pick<PlanLimitChecker, "uploadRules">,
): Router {
  const router = Router({ mergeParams: true });
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: maxUploadBytes, files: 1 } });
  const multerUpload: RequestHandler = (request, response, next) => {
    upload.single("file")(request, response, (error: unknown) => {
      if (!error) { next(); return; }
      const cap = Math.min(maxUploadBytes, (response.locals.uploadRules as UploadRules | null | undefined)?.fileBytes ?? maxUploadBytes);
      next((error as { code?: string }).code === "LIMIT_FILE_SIZE" ? fileTooLarge(cap) : error);
    });
  };
  // The store's plan rules, and an early refusal (before the body is read) when the request says it is too big.
  const planRules: RequestHandler = (request, response, next) => {
    const storeId = request.storeContext!.storeId;
    Promise.resolve(plans ? plans.uploadRules(storeId) : null).then((rules) => {
      response.locals.uploadRules = rules;
      const cap = Math.min(maxUploadBytes, rules?.fileBytes ?? maxUploadBytes);
      const length = Number(request.headers["content-length"]);
      next(Number.isFinite(length) && length > cap + MULTIPART_OVERHEAD_BYTES ? fileTooLarge(cap) : undefined);
    }, next);
  };
  // Per store, across all its people and addresses (the per-address limit below stays as well).
  const storeUploadLimit = rateLimit({
    windowMs: 60_000,
    limit: (_request, response) => (response.locals.uploadRules as UploadRules | null | undefined)?.uploadsPerMinute ?? UNPLANNED_UPLOADS_PER_MINUTE,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (request) => `store:${request.storeContext!.storeId}`,
    handler: (_request, _response, next) => next(new ApiError(429, "UPLOAD_RATE_LIMIT", "That's a lot of uploads in one go. Wait a minute and try again.")),
  });
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
  router.post<{ storeId: string }>("/", requireStorePermission("media:upload"), uploadLimit, planRules, storeUploadLimit, multerUpload, async (request, response) => {
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
