import { Router } from "express";
import type { SqlExecutor } from "../commerce/repository.js";

export interface PublicStoreDetails {
  shippingMinor: number;
  shippingCopy: string;
  id: string;
  name: string;
  slug: string;
  currency: string;
  country: string;
}

export function createPublicStoreRouter(database: SqlExecutor): Router {
  const router = Router({ mergeParams: true });
  router.get<{ storeId: string }>("/", async (request, response) => {
    const result = await database.query<PublicStoreDetails>(
      `SELECT s."id", s."name", s."slug", s."currency", s."country", COALESCE(ss."shippingMinor", 0) AS "shippingMinor", COALESCE(ss."shippingCopy",'') AS "shippingCopy" FROM "Store" s LEFT JOIN "StoreSettings" ss ON ss."storeId" = s."id" WHERE s."id" = $1 AND s."archivedAt" IS NULL`,
      [String(request.params.storeId)],
    );
    const store = result.rows[0];
    if (!store) return response.status(404).json({ error: { code: "STORE_NOT_FOUND", message: "Store not found" } });
    response.json({ store });
  });
  return router;
}

export function createPublicStoreBySlugRouter(database: SqlExecutor): Router {
  const router = Router({ mergeParams: true });
  router.get<{ slug: string }>("/", async (request, response) => {
    const result = await database.query<PublicStoreDetails>(
      `SELECT s."id", s."name", s."slug", s."currency", s."country", COALESCE(ss."shippingMinor", 0) AS "shippingMinor", COALESCE(ss."shippingCopy",'') AS "shippingCopy" FROM "Store" s LEFT JOIN "StoreSettings" ss ON ss."storeId" = s."id" WHERE s."slug" = $1 AND s."archivedAt" IS NULL`,
      [String(request.params.slug)],
    );
    const store = result.rows[0];
    if (!store) return response.status(404).json({ error: { code: "STORE_NOT_FOUND", message: "Store not found" } });
    response.json({ store });
  });
  return router;
}
