import express from "express";
import multer from "multer";
import { z } from "zod";
import { requireMerchant, requireStorePermission } from "../auth/middleware.js";
import type { AuthProvider } from "../auth/types.js";
import type { DigitalService } from "./digital.js";
import { notificationTypes, renderOrderNotification, type NotificationService } from "./notifications.js";
import { ApiError } from "../http/errors.js";
const brandSchema = z.object({ brandName: z.string().max(100).optional(), replyTo: z.email().optional(), accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/), logoUrl: z.url().refine((v) => v.startsWith("https://")).optional() });
const typeSchema = z.object({ type: z.enum(notificationTypes) });
const asyncRoute = (handler: (req: express.Request, res: express.Response) => Promise<unknown>): express.RequestHandler => (req, res, next) => { void handler(req, res).catch(next); };
export function createNotificationRouter(service: NotificationService, auth: AuthProvider) {
  const router = express.Router({ mergeParams: true }); router.use(requireMerchant(auth));
  router.get("/", requireStorePermission("orders:view"), asyncRoute(async (req, res) => res.json({ notifications: await service.list(req.storeContext!.storeId, typeof req.query.orderId === "string" ? req.query.orderId : undefined) })));
  router.get("/branding", requireStorePermission("settings:manage"), asyncRoute(async (req, res) => res.json(await service.branding(req.storeContext!.storeId))));
  router.put("/branding", requireStorePermission("settings:manage"), asyncRoute(async (req, res) => res.json(await service.saveBranding(req.storeContext!.storeId, brandSchema.parse(req.body)))));
  router.post("/preview", requireStorePermission("settings:manage"), asyncRoute(async (req, res) => {
    const { type } = typeSchema.parse(req.body); const branding = await service.branding(req.storeContext!.storeId);
    res.json(renderOrderNotification(type, { brandName: String(branding.brandName ?? "Jelly Shop"), accentColor: String(branding.accentColor ?? "#192642"), number: "PREVIEW-001", totalMinor: 1200, currency: "USD", orderUrl: "https://example.invalid/order", customerName: "Customer" }));
  })); return router;
}
export function createOrderNotificationRouter(service: NotificationService, auth: AuthProvider) {
  const router = express.Router({ mergeParams: true }); router.use(requireMerchant(auth));
  router.post("/:orderId/notifications/resend", requireStorePermission("orders:manage"), asyncRoute(async (req, res) => { const { type } = typeSchema.parse(req.body); res.status(201).json(await service.resend(req.storeContext!.storeId, String(req.params.orderId), type)); })); return router;
}
export function createDigitalProductRouter(service: DigitalService, auth: AuthProvider) {
  const router = express.Router({ mergeParams: true }); router.use(requireMerchant(auth));
  router.get("/:productId", requireStorePermission("catalog:view"), asyncRoute(async (req, res) => res.json(await service.getProduct(req.storeContext!.storeId, String(req.params.productId)))));
  router.put("/:productId", requireStorePermission("catalog:edit"), asyncRoute(async (req, res) => { const { fulfillmentType } = z.object({ fulfillmentType: z.enum(["PHYSICAL", "DIGITAL"]) }).parse(req.body); res.json(await service.setType(req.storeContext!.storeId, String(req.params.productId), fulfillmentType)); }));
  router.post("/:productId/assets", requireStorePermission("catalog:edit"), multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024, files: 1 } }).single("file"), asyncRoute(async (req, res) => {
    if (!req.file) throw new ApiError(422, "FILE_REQUIRED", "Select a private digital file");
    const nullableInteger = z.preprocess((v) => v === "" || v === undefined || v === "null" ? null : v, z.coerce.number().int().positive().max(365000).nullable());
    const limits = z.object({ maxDownloads: nullableInteger, expiresAfterDays: nullableInteger }).parse(req.body);
    res.status(201).json(await service.upload(req.storeContext!.storeId, String(req.params.productId), { bytes: req.file.buffer, filename: req.file.originalname, mimeType: req.file.mimetype }, limits));
  }));
  router.delete("/:productId/assets/:assetId", requireStorePermission("catalog:edit"), asyncRoute(async (req, res) => { await service.archive(req.storeContext!.storeId, String(req.params.productId), String(req.params.assetId)); res.sendStatus(204); })); return router;
}
export function createPublicDigitalRouter(service: DigitalService) {
  const router = express.Router({ mergeParams: true });
  router.get("/:entitlementId", asyncRoute(async (req, res) => {
    const token = z.string().min(30).max(128).parse(req.query.token);
    const result = await service.download(String(req.params.storeId), String(req.params.entitlementId), token);
    res.set({ "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff", "Content-Type": "application/octet-stream", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(result.filename)}` }).send(result.bytes);
  })); return router;
}
