import { Router } from "express";
import { z } from "zod";
import { requireMerchant, requireStorePermission } from "../auth/middleware.js";
import type { AuthProvider } from "../auth/types.js";
import { REVIEW_STATUSES, type ProductReviewService } from "./service.js";

type Api = Pick<ProductReviewService, "summaries" | "listPublished" | "submit" | "listForMerchant" | "setStatus" | "remove">;

const submitSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().max(120).optional(),
  body: z.string().max(2000).optional(),
  authorName: z.string().min(1).max(80),
  email: z.string().max(254).optional(),
  // Left empty by people; bots that fill every field are quietly ignored.
  website: z.string().max(200).optional(),
}).strict();
const pageSchema = z.object({ limit: z.coerce.number().int().min(1).max(100).optional(), offset: z.coerce.number().int().min(0).optional() });
const statusSchema = z.object({ status: z.enum(REVIEW_STATUSES as [string, ...string[]]) }).strict();

/**
 * Shoppers, under `/api/public/stores/:storeId/reviews`:
 * `GET /summary?productIds=a,b` (ratings for product cards), `GET /products/:productId` (published reviews),
 * `POST /products/:productId` (a new review, waits for the merchant).
 */
export function createPublicReviewRouter(service: Api): Router {
  const router = Router({ mergeParams: true });
  router.get<{ storeId: string }>("/summary", async (request, response, next) => {
    try {
      const ids = String(request.query.productIds ?? "").split(",").map((id) => id.trim()).filter(Boolean);
      response.set("Cache-Control", "public, max-age=60").json({ summaries: await service.summaries(String(request.params.storeId), ids) });
    } catch (error) { next(error); }
  });
  router.get<{ storeId: string; productId: string }>("/products/:productId", async (request, response, next) => {
    try {
      const page = pageSchema.parse(request.query);
      response.set("Cache-Control", "public, max-age=60").json(await service.listPublished(String(request.params.storeId), String(request.params.productId), page));
    } catch (error) { next(error); }
  });
  router.post<{ storeId: string; productId: string }>("/products/:productId", async (request, response, next) => {
    try {
      const input = submitSchema.parse(request.body ?? {});
      if (input.website) { response.status(202).json({ status: "pending" }); return; }
      const result = await service.submit(String(request.params.storeId), String(request.params.productId), input, request.ip ?? "unknown");
      response.status(202).set("Cache-Control", "no-store").json(result);
    } catch (error) { next(error); }
  });
  return router;
}

/** Merchants, under `/api/stores/:storeId/reviews`: list, publish or hide (`PATCH /:reviewId`), delete. */
export function createMerchantReviewRouter(service: Api, authProvider: AuthProvider): Router {
  const router = Router({ mergeParams: true });
  router.get("/", requireMerchant(authProvider), requireStorePermission("catalog:view"), async (request, response, next) => {
    try {
      const page = pageSchema.parse(request.query);
      const status = typeof request.query.status === "string" && (REVIEW_STATUSES as readonly string[]).includes(request.query.status) ? request.query.status as (typeof REVIEW_STATUSES)[number] : undefined;
      response.json(await service.listForMerchant(request.storeContext!.storeId, { ...page, status }));
    } catch (error) { next(error); }
  });
  router.patch<{ reviewId: string }>("/:reviewId", requireMerchant(authProvider), requireStorePermission("catalog:edit"), async (request, response, next) => {
    try {
      const { status } = statusSchema.parse(request.body ?? {});
      await service.setStatus(request.storeContext!.storeId, String(request.params.reviewId), status as (typeof REVIEW_STATUSES)[number]);
      response.json({ ok: true });
    } catch (error) { next(error); }
  });
  router.delete<{ reviewId: string }>("/:reviewId", requireMerchant(authProvider), requireStorePermission("catalog:edit"), async (request, response, next) => {
    try {
      await service.remove(request.storeContext!.storeId, String(request.params.reviewId));
      response.status(204).end();
    } catch (error) { next(error); }
  });
  return router;
}
