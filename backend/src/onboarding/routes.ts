import { Router } from "express";
import rateLimit from "express-rate-limit";
import multer from "multer";
import sharp from "sharp";
import { z } from "zod";
import { requireMerchant } from "../auth/middleware.js";
import type { AuthProvider } from "../auth/types.js";
import { ApiError } from "../http/errors.js";
import { validateImage } from "../media/validation.js";
import { acceptConsentSchema, imageKindSchema, onboardingRevisionSchema, profileSchema, saveOnboardingSchema } from "./schema.js";
import type { OnboardingService } from "./service.js";

const imageLimit = 2 * 1024 * 1024;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: imageLimit, files: 1, fields: 0, parts: 2 } }).single("file");

async function processedImage(input: Buffer) {
  try {
    await validateImage(input);
    const image = await sharp(input, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 84 })
      .toBuffer();
    if (image.length > imageLimit) throw new ApiError(413, "MEDIA_TOO_LARGE", "Choose an image smaller than 2 MB.");
    return image;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(415, "MEDIA_INVALID", "The uploaded image could not be decoded.");
  }
}

export function createOnboardingRouter(auth: AuthProvider, service: OnboardingService): Router {
  const router = Router();
  const uploadLimiter = rateLimit({
    windowMs: 60_000,
    limit: 12,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: request => request.merchant!.userId,
  });
  router.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  router.get("/policies", (_req, res) => { res.json(service.getPolicies()); });
  router.use(requireMerchant(auth), (req, _res, next) => {
    if (req.merchant?.emailVerified === false) {
      next(new ApiError(403, "MERCHANT_EMAIL_UNVERIFIED", "Confirm your email before setting up your store."));
      return;
    }
    next();
  });
  router.get("/", async (req, res) => {
    const merchant = req.merchant!;
    res.json(await service.get(merchant.userId, merchant.displayName));
  });
  router.patch("/", async (req, res) => {
    res.json(await service.save(req.merchant!.userId, saveOnboardingSchema.parse(req.body)));
  });
  router.post("/consent", async (req, res) => {
    const { version } = acceptConsentSchema.parse(req.body);
    await service.acceptConsent(req.merchant!.userId, version);
    res.sendStatus(204);
  });
  router.get("/availability", async (req, res) => {
    const slug = z.string().max(100).parse(req.query.slug);
    res.json({ available: await service.available(slug) });
  });
  router.post("/complete", async (req, res) => {
    const { revision } = onboardingRevisionSchema.parse(req.body);
    res.json({ store: await service.complete(req.merchant!.userId, revision) });
  });
  router.get("/profile", async (req, res) => {
    const merchant = req.merchant!;
    const profile = await service.getProfile(merchant.userId);
    res.json({ ...profile, email: merchant.email ?? profile.email });
  });
  router.patch("/profile", async (req, res) => {
    const merchant = req.merchant!;
    const profile = await service.updateProfile(merchant.userId, profileSchema.parse(req.body));
    res.json({ ...profile, email: merchant.email ?? profile.email });
  });
  router.get("/images/:kind", async (req, res) => {
    const kind = imageKindSchema.parse(req.params.kind);
    const image = await service.getImage(req.merchant!.userId, kind);
    if (!image) throw new ApiError(404, "MEDIA_NOT_FOUND", "There is no image for this field yet.");
    res.type("image/webp").set("X-Content-Type-Options", "nosniff").send(image);
  });
  router.put("/images/:kind", uploadLimiter, (req, res, next) => {
    upload(req, res, error => {
      if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
        next(new ApiError(413, "MEDIA_TOO_LARGE", "Choose an image smaller than 2 MB."));
      } else if (error) {
        next(new ApiError(400, "MEDIA_UPLOAD_INVALID", "Choose a single image to upload."));
      } else next();
    });
  }, async (req, res) => {
    const kind = imageKindSchema.parse(req.params.kind);
    if (!req.file) throw new ApiError(400, "MEDIA_REQUIRED", "Choose an image to upload.");
    await service.uploadImage(req.merchant!.userId, kind, await processedImage(req.file.buffer));
    res.status(200).json({ url: `/api/onboarding/images/${kind}` });
  });
  router.delete("/images/:kind", async (req, res) => {
    await service.removeImage(req.merchant!.userId, imageKindSchema.parse(req.params.kind));
    res.sendStatus(204);
  });
  return router;
}
