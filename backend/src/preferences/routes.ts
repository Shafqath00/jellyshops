import { Router, type Request } from "express";
import { z } from "zod";
import { requireMerchant, requireStorePermission } from "../auth/middleware.js";
import type { AuthProvider } from "../auth/types.js";
import type { CommerceDatabase } from "../commerce/repository.js";
import { ApiError } from "../http/errors.js";
import { MAX_REDIRECT_CSV_BYTES, type UrlRedirectService } from "./redirects.js";
import { collectSeoHealth } from "./seo-health.js";
import type { PreferencesActor, StorePreferencesService } from "./service.js";

const storeId = (request: Request) => request.storeContext!.storeId;
function actor(request: Request): PreferencesActor {
  const merchant = request.merchant!;
  const name = merchant.displayName?.trim() || merchant.email?.split("@")[0]?.trim() || null;
  return { userId: merchant.userId, name: name ? name.slice(0, 120) : null };
}
function body<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new ApiError(422, "REQUEST_INVALID", "Check the details and try again.");
  return parsed.data;
}

const saveSchema = z.object({ revision: z.number().int().nonnegative(), preferences: z.unknown() }).strict();
const redirectSchema = z.object({ from: z.string().max(1000), to: z.string().max(1000) }).strict();
const removeSchema = z.object({ ids: z.array(z.string().max(120)).min(1).max(500) }).strict();
const importSchema = z.object({ csv: z.string().max(MAX_REDIRECT_CSV_BYTES * 2), apply: z.boolean().default(false), replace: z.boolean().default(false) }).strict();
const listSchema = z.object({ q: z.string().max(200).optional(), offset: z.coerce.number().int().min(0).max(100000).optional(), limit: z.coerce.number().int().min(1).max(200).optional() }).strip();

/**
 * Merchant routes for store preferences and redirects. Only people who may manage settings (owner or admin) can read
 * or change them.
 */
function guarded(auth: AuthProvider): Router {
  const router = Router({ mergeParams: true });
  router.use(requireMerchant(auth), requireStorePermission("settings:manage"), (_request, response, next) => { response.setHeader("Cache-Control", "no-store"); next(); });
  return router;
}

/** Mounted at /api/stores/:storeId/preferences. */
export function createPreferencesRouter(auth: AuthProvider, preferences: StorePreferencesService, database?: CommerceDatabase): Router {
  const router = guarded(auth);
  router.get("/", async (request, response) => { response.json(await preferences.get(storeId(request))); });
  router.put("/", async (request, response) => {
    const input = body(saveSchema, request.body);
    response.json(await preferences.save(storeId(request), input, actor(request)));
  });
  router.get("/history", async (request, response) => { response.json({ changes: await preferences.history(storeId(request)) }); });
  // SEO health check and the policy states for the setup checklist: counts what is wrong in the catalogue and content.
  router.get("/seo-health", async (request, response) => {
    if (!database) throw new ApiError(503, "SEO_HEALTH_UNAVAILABLE", "The SEO check isn't available right now.");
    const saved = await preferences.get(storeId(request));
    response.json(await collectSeoHealth(database, storeId(request), saved.preferences));
  });
  return router;
}

/** Mounted at /api/stores/:storeId/redirects. */
export function createRedirectsRouter(auth: AuthProvider, redirects: UrlRedirectService): Router {
  const router = guarded(auth);

  router.get("/", async (request, response) => { response.json(await redirects.list(storeId(request), body(listSchema, request.query))); });
  router.post("/", async (request, response) => { response.status(201).json({ redirect: await redirects.create(storeId(request), body(redirectSchema, request.body)) }); });
  router.post("/import", async (request, response) => {
    const input = body(importSchema, request.body);
    response.json(await redirects.importCsv(storeId(request), input.csv, { apply: input.apply, replace: input.replace }));
  });
  router.post("/delete", async (request, response) => { response.json({ removed: await redirects.remove(storeId(request), body(removeSchema, request.body).ids) }); });
  router.put("/:redirectId", async (request, response) => {
    response.json({ redirect: await redirects.update(storeId(request), String(request.params.redirectId), body(redirectSchema, request.body)) });
  });
  router.delete("/:redirectId", async (request, response) => {
    const removed = await redirects.remove(storeId(request), [String(request.params.redirectId)]);
    if (!removed) throw new ApiError(404, "REDIRECT_NOT_FOUND", "This redirect doesn't exist any more.");
    response.status(204).end();
  });
  return router;
}

/**
 * Public routes for storefront pages, mounted at /api/public/stores/:storeId: the preferences (everything in them is
 * shown on the storefront anyway: titles, tracking ids, contact details) and the redirect lookup.
 */
export function createPublicPreferencesRouter(preferences: StorePreferencesService, redirects: UrlRedirectService): Router {
  const router = Router({ mergeParams: true });
  router.get<{ storeId: string }>("/preferences", async (request, response) => {
    response.setHeader("Cache-Control", "public, max-age=60");
    response.json({ preferences: await preferences.getPublic(String(request.params.storeId)) });
  });
  router.get<{ storeId: string }>("/url-redirect", async (request, response) => {
    const path = typeof request.query.path === "string" ? request.query.path.slice(0, 1000) : "";
    response.setHeader("Cache-Control", "public, max-age=60");
    response.json({ to: path ? await redirects.resolve(String(request.params.storeId), path) : null });
  });
  return router;
}
