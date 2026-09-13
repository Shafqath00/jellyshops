import { Router } from "express";
import rateLimit from "express-rate-limit";
import multer from "multer";
import { requireMerchant, requireStoreAccess } from "../auth/middleware.js";
import type { AuthProvider } from "../auth/types.js";
import { ApiError } from "../http/errors.js";
import type { MediaService } from "./service.js";

export function createMediaRouter(service: MediaService, authProvider: AuthProvider, maxUploadBytes: number): Router {
  const router = Router({ mergeParams: true });
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: maxUploadBytes, files: 1 } });
  const uploadLimit = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false });

  router.use(requireMerchant(authProvider));
  router.post<{ storeId: string }>("/", requireStoreAccess("media:upload"), uploadLimit, upload.single("file"), async (request, response) => {
    if (!request.file) throw new ApiError(400, "MEDIA_REQUIRED", "Choose an image to upload");
    response.status(201).json(await service.upload(request.params.storeId, request.file));
  });

  router.get<{ storeId: string }>("/", requireStoreAccess("storefront:view"), async (request, response) => {
    response.json(await service.list(request.params.storeId));
  });

  router.delete<{ storeId: string; mediaId: string }>("/:mediaId", requireStoreAccess("media:delete"), async (request, response) => {
    await service.remove(request.params.storeId, request.params.mediaId);
    response.sendStatus(204);
  });

  return router;
}

export function createPublicMediaRouter(service: MediaService): Router {
  const router = Router();
  router.get<{ storeId: string; mediaId: string }>("/:storeId/:mediaId", async (request, response) => {
    const media = await service.open(request.params.storeId, request.params.mediaId);
    response.type(media.record.mimeType).send(media.contents);
  });
  return router;
}
