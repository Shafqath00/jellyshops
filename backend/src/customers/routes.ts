import { Router, type Request } from "express";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requireMerchant, requireStorePermission } from "../auth/middleware.js";
import type { AuthProvider } from "../auth/types.js";
import { ApiError } from "../http/errors.js";
import type { CustomerIdentity, CustomerService } from "./service.js";

export type CustomerVerifier = (token: string) => Promise<CustomerIdentity>;
export function supabaseCustomerVerifier(url: string, key: string): CustomerVerifier {
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  return async (token) => {
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) throw new ApiError(401, "CUSTOMER_AUTH_INVALID", "Sign in to your customer account.");
    return { id: data.user.id, email: data.user.email ?? "", verified: Boolean(data.user.email_confirmed_at) };
  };
}
export async function customerIdentity(request: Request, verify: CustomerVerifier): Promise<CustomerIdentity> {
  const match = request.header("authorization")?.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new ApiError(401, "CUSTOMER_AUTH_REQUIRED", "Sign in to your customer account.");
  const identity = await verify(match[1]);
  if (!identity.verified) throw new ApiError(401, "CUSTOMER_VERIFICATION_REQUIRED", "Verify your email before continuing.");
  return identity;
}
const store = (request: Request) => String(request.params.storeId);
const param = (request: Request, name: string) => String(request.params[name]);
const revision = (raw: unknown): number => {
  const result = z.number().int().nonnegative().safeParse(raw);
  if (!result.success) throw new ApiError(422, "CUSTOMER_INPUT_INVALID", "A revision is required.");
  return result.data;
};

export function createCustomerRouter(service: CustomerService, verify: CustomerVerifier): Router {
  const router = Router({ mergeParams: true });
  router.use(async (request, response, next) => {
    response.setHeader("Cache-Control", "private, no-store");
    response.locals.customer = await customerIdentity(request, verify); next();
  });
  router.get("/profile", async (req, res) => { res.json(await service.profile(store(req), res.locals.customer)); });
  router.patch("/profile", async (req, res) => { res.json(await service.updateProfile(store(req), res.locals.customer, req.body)); });
  router.get("/addresses", async (req, res) => { res.json({ addresses: await service.addresses(store(req), res.locals.customer) }); });
  router.post("/addresses", async (req, res) => { res.status(201).json(await service.saveAddress(store(req), res.locals.customer, undefined, req.body)); });
  router.patch("/addresses/:addressId", async (req, res) => { res.json(await service.saveAddress(store(req), res.locals.customer, param(req, "addressId"), req.body)); });
  router.delete("/addresses/:addressId", async (req, res) => { await service.deleteAddress(store(req), res.locals.customer, param(req, "addressId"), revision(req.body?.revision)); res.sendStatus(204); });
  router.get("/orders", async (req, res) => { res.json({ orders: await service.orders(store(req), res.locals.customer) }); });
  router.get("/orders/:orderId", async (req, res) => { res.json(await service.orders(store(req), res.locals.customer, param(req, "orderId"))); });
  router.get("/wishlist", async (req, res) => { res.json({ items: await service.wishlist(store(req), res.locals.customer) }); });
  router.post("/wishlist/merge", async (req, res) => { if (!Array.isArray(req.body?.productIds)) throw new ApiError(422, "CUSTOMER_INPUT_INVALID", "A list of product IDs is required."); res.json({ items: await service.wishlist(store(req), res.locals.customer, req.body.productIds) }); });
  router.delete("/wishlist/:productId", async (req, res) => { await service.removeWishlistItem(store(req), res.locals.customer, param(req, "productId")); res.sendStatus(204); });
  return router;
}

export function createEngagementRouter(service: CustomerService, rateLimit: (storeId: string, ip: string) => Promise<void>): Router {
  const router = Router({ mergeParams: true });
  router.use(async (req, res, next) => { res.setHeader("Cache-Control", "no-store"); await rateLimit(store(req), req.ip ?? "unknown"); next(); });
  router.post("/newsletter", async (req, res) => { await service.subscribe(store(req), req.body); res.status(202).json({ accepted: true }); });
  router.post("/newsletter/unsubscribe", async (req, res) => {
    if (typeof req.body?.token !== "string") throw new ApiError(422, "UNSUBSCRIBE_INVALID", "An unsubscribe token is required.");
    await service.unsubscribe(store(req), req.body.token); res.json({ unsubscribed: true });
  });
  router.post("/contact", async (req, res) => { await service.contact(store(req), req.body); res.status(201).json({ received: true }); });
  return router;
}

export function createMerchantEngagementRouter(service: CustomerService, auth: AuthProvider): Router {
  const router = Router({ mergeParams: true });
  router.use(requireMerchant(auth), requireStorePermission("settings:manage"));
  router.use((_req, res, next) => { res.setHeader("Cache-Control", "private, no-store"); next(); });
  router.get("/subscribers.csv", async (req, res) => {
    const rows = await service.subscribers(req.storeContext!.storeId);
    const cell = (value: unknown) => { const text = value instanceof Date ? value.toISOString() : String(value ?? ""); return `"${(/^[=+\-@\t\r]/.test(text) ? "'" + text : text).replaceAll('"', '""')}"`; };
    res.type("text/csv").setHeader("Content-Disposition", 'attachment; filename="subscribers.csv"');
    res.send(["email,consentAt,source,unsubscribedAt,unsubscribeUrl", ...rows.map((row) => [row.email, row.consentAt, row.source, row.unsubscribedAt, row.unsubscribeUrl].map(cell).join(","))].join("\r\n"));
  });
  router.get("/enquiries", async (req, res) => { res.json({ enquiries: await service.enquiries(req.storeContext!.storeId) }); });
  router.patch("/enquiries/:enquiryId", async (req, res) => { res.json(await service.updateEnquiry(req.storeContext!.storeId, param(req, "enquiryId"), req.body)); });
  return router;
}
