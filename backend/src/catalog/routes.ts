import { Router } from "express";
import { getDemoCatalog } from "./demo-catalog-provider.js";

export function createCatalogRouter(): Router {
  const router = Router();
  router.get("/", (_request, response) => response.json(getDemoCatalog()));
  return router;
}
