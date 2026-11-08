import { Router } from "express";

import { requireMerchant, requireStorePermission } from "../auth/middleware.js";
import type { AuthProvider } from "../auth/types.js";
import { SALES_PERIODS, type AdminSalesService, type AdminSummaryService, type CustomerService, type SalesPeriod } from "./service.js";

export function createAdminRouter(
  services: { summary: Pick<AdminSummaryService, "getSummary">; customers: Pick<CustomerService, "list" | "get">; sales?: Pick<AdminSalesService, "getSales"> },
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
