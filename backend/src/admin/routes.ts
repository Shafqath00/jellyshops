import { Router } from "express";
import { z } from "zod";

import { requireMerchant, requireStorePermission } from "../auth/middleware.js";
import type { AuthProvider } from "../auth/types.js";
import { SALES_PERIODS, type AdminSalesService, type AdminSummaryService, type CustomerService, type OrderTagService, type SalesPeriod } from "./service.js";

export function createAdminRouter(
  services: { summary: Pick<AdminSummaryService, "getSummary">; customers: Pick<CustomerService, "list" | "get"> & Partial<Pick<CustomerService, "create" | "update">>; sales?: Pick<AdminSalesService, "getSales">; orderTags?: Pick<OrderTagService, "setTags"> },
  auth: AuthProvider,
): Router {
  const router = Router({ mergeParams: true });
  
  router.get("/admin-summary", requireMerchant(auth), requireStorePermission("payments:view"), async (request, response, next) => {
    try { response.json(await services.summary.getSummary(request.storeContext!.storeId)); }
    catch (error) { next(error); }
  });
  router.get("/admin-summary/sales", requireMerchant(auth), requireStorePermission("payments:view"), async (request, response, next) => {
    try {
      if (!services.sales) { response.status(404).json({ error: { code: "NOT_FOUND", message: "Sales figures are not available." } }); return; }
      const days = Number(request.query.days ?? 30);
      if (!SALES_PERIODS.includes(days as SalesPeriod)) { response.status(400).json({ error: { code: "INVALID_PERIOD", message: "Choose a period of 1, 7, 30 or 90 days." } }); return; }
      response.json(await services.sales.getSales(request.storeContext!.storeId, days as SalesPeriod));
    } catch (error) { next(error); }
  });
  const text = (max: number) => z.string().max(max).optional();
  const profile = z.object({
    firstName: text(120), lastName: text(120), phone: text(40), note: text(5000),
    tags: z.array(z.string().trim().min(1).max(60)).max(50).optional(),
    address: z.object({ line1: text(200), line2: text(200), city: text(120), region: text(120), postalCode: text(20), country: text(2) }).strict().nullable().optional(),
    acceptsEmailMarketing: z.boolean().optional(),
  }).strict();
  router.post("/customers", requireMerchant(auth), requireStorePermission("orders:manage"), async (request, response, next) => {
    try {
      if (!services.customers.create) { response.status(404).json({ error: { code: "NOT_FOUND", message: "Adding customers is not available." } }); return; }
      const input = profile.extend({ email: z.string().trim().min(3).max(254) }).parse(request.body);
      response.status(201).json({ customer: await services.customers.create(request.storeContext!.storeId, input) });
    } catch (error) { next(error); }
  });
  router.patch("/customers/:customerId", requireMerchant(auth), requireStorePermission("orders:manage"), async (request, response, next) => {
    try {
      if (!services.customers.update) { response.status(404).json({ error: { code: "NOT_FOUND", message: "Editing customers is not available." } }); return; }
      const input = profile.extend({ revision: z.number().int().nonnegative().optional() }).parse(request.body);
      response.json({ customer: await services.customers.update(request.storeContext!.storeId, String(request.params.customerId), input) });
    } catch (error) { next(error); }
  });
  router.put("/orders/:orderId/tags", requireMerchant(auth), requireStorePermission("orders:manage"), async (request, response, next) => {
    try {
      if (!services.orderTags) { response.status(404).json({ error: { code: "NOT_FOUND", message: "Order tags are not available." } }); return; }
      const { tags } = z.object({ tags: z.array(z.string().trim().min(1).max(60)).max(50) }).strict().parse(request.body);
      response.json({ tags: await services.orderTags.setTags(request.storeContext!.storeId, String(request.params.orderId), tags) });
    } catch (error) { next(error); }
  });
  router.get("/customers", requireMerchant(auth), requireStorePermission("payments:view"), async (request, response, next) => {
    try { response.json({ customers: await services.customers.list(request.storeContext!.storeId) }); }
    catch (error) { next(error); }
  });
  router.get("/customers/:customerId", requireMerchant(auth), requireStorePermission("payments:view"), async (request, response, next) => {
    try {
      const customer = await services.customers.get(request.storeContext!.storeId, String(request.params.customerId));
      if (!customer) { response.status(404).json({ error: { code: "CUSTOMER_NOT_FOUND", message: "Customer not found." } }); return; }
      response.json({ customer });
    } catch (error) { next(error); }
  });
  return router;
}
