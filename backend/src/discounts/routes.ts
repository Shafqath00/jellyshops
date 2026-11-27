import { Router } from "express";
import { z } from "zod";
import { requireMerchant, requireStorePermission } from "../auth/middleware.js";
import type { AuthProvider } from "../auth/types.js";
import { ApiError } from "../http/errors.js";
import type { DiscountService } from "./service.js";

const idsSchema = z.object({ ids: z.array(z.string().min(1).max(120)).min(1).max(500) }).strict();
const codesSchema = z.object({ count: z.number().int().min(1).max(100_000), prefix: z.string().max(20).optional(), length: z.number().int().min(6).max(16).optional() }).strict();
const bulkSchema = z.object({ ids: idsSchema.shape.ids, action: z.enum(["enable", "disable", "delete"]) }).strict();

function ids(body: unknown) {
  const parsed = bulkSchema.safeParse(body ?? {});
  if (!parsed.success) throw new ApiError(422, "DISCOUNT_INPUT_INVALID", "Choose up to 500 discounts.");
  return parsed.data;
}

/**
 * Merchants, under `/api/stores/:storeId/discounts`. Anyone who can see orders may see discounts; only owners and
 * admins (`discounts:manage`) may change them. Bodies are checked by the shared rules in the service.
 *   GET /            list            POST /          create
 *   GET /:id         one             PUT /:id        change          DELETE /:id   delete
 *   POST /bulk       {ids, action: enable|disable|delete}
 *   GET /code-check?code=&except=   is a code free      POST /generate-code {prefix?}
 *   POST /:id/duplicate             a switched-off copy
 *   GET /:id/codes?offset=&limit=   codes with uses     GET /:id/codes.csv   all codes      POST /:id/codes {count, prefix?, length?}
 */
export function createDiscountRouter(service: DiscountService, authProvider: AuthProvider): Router {
  const router = Router({ mergeParams: true });
  const view = [requireMerchant(authProvider), requireStorePermission("orders:view")];
  const manage = [requireMerchant(authProvider), requireStorePermission("discounts:manage")];
  const storeId = (request: { storeContext?: { storeId: string } }) => request.storeContext!.storeId;

  router.get("/", ...view, async (request, response, next) => {
    try { response.json(await service.listWithResults(storeId(request))); } catch (error) { next(error); }
  });
  router.get("/code-check", ...manage, async (request, response, next) => {
    try {
      const code = typeof request.query.code === "string" ? request.query.code.slice(0, 60) : "";
      const except = typeof request.query.except === "string" ? request.query.except.slice(0, 120) : undefined;
      response.json(await service.codeAvailable(storeId(request), code, except));
    } catch (error) { next(error); }
  });
  router.post("/generate-code", ...manage, async (request, response, next) => {
    try {
      const prefix = typeof request.body?.prefix === "string" ? request.body.prefix.slice(0, 20) : "";
      response.json({ code: await service.generateCode(storeId(request), prefix) });
    } catch (error) { next(error); }
  });
  router.post("/bulk", ...manage, async (request, response, next) => {
    try {
      const { ids: chosen, action } = ids(request.body);
      const changed = action === "delete" ? await service.removeMany(storeId(request), chosen) : await service.setActive(storeId(request), chosen, action === "enable");
      response.json({ changed });
    } catch (error) { next(error); }
  });
  router.post<{ storeId: string; id: string }>("/:id/duplicate", ...manage, async (request, response, next) => {
    try { response.status(201).json({ discount: await service.duplicate(storeId(request), String(request.params.id)) }); } catch (error) { next(error); }
  });
  router.get<{ storeId: string; id: string }>("/:id/codes", ...view, async (request, response, next) => {
    try {
      const offset = Number(request.query.offset ?? 0) || 0;
      const limit = Number(request.query.limit ?? 50) || 50;
      response.json(await service.listCodes(storeId(request), String(request.params.id), { offset, limit }));
    } catch (error) { next(error); }
  });
  router.get<{ storeId: string; id: string }>("/:id/codes.csv", ...view, async (request, response, next) => {
    try {
      const csv = await service.codesCsv(storeId(request), String(request.params.id));
      response.set("Content-Type", "text/csv; charset=utf-8").set("Content-Disposition", 'attachment; filename="discount-codes.csv"').set("Cache-Control", "no-store").send(csv);
    } catch (error) { next(error); }
  });
  router.post<{ storeId: string; id: string }>("/:id/codes", ...manage, async (request, response, next) => {
    try {
      const parsed = codesSchema.safeParse(request.body ?? {});
      if (!parsed.success) throw new ApiError(422, "DISCOUNT_INPUT_INVALID", "Say how many codes to make.");
      response.status(201).json(await service.generateCodes(storeId(request), String(request.params.id), parsed.data));
    } catch (error) { next(error); }
  });
  router.post("/", ...manage, async (request, response, next) => {
    try { response.status(201).json({ discount: await service.create(storeId(request), request.body ?? {}) }); } catch (error) { next(error); }
  });
  router.get<{ storeId: string; id: string }>("/:id", ...view, async (request, response, next) => {
    try { response.json({ discount: await service.get(storeId(request), String(request.params.id)) }); } catch (error) { next(error); }
  });
  router.put<{ storeId: string; id: string }>("/:id", ...manage, async (request, response, next) => {
    try { response.json({ discount: await service.update(storeId(request), String(request.params.id), request.body ?? {}) }); } catch (error) { next(error); }
  });
  router.delete<{ storeId: string; id: string }>("/:id", ...manage, async (request, response, next) => {
    try { await service.remove(storeId(request), String(request.params.id)); response.status(204).end(); } catch (error) { next(error); }
  });
  return router;
}
