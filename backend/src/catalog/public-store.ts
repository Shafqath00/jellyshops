import { Router } from "express";
import type { SqlExecutor } from "../commerce/repository.js";

export interface PublicStoreDetails {
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
      `SELECT "id", "name", "slug", "currency", "country" FROM "Store" WHERE "id" = $1 AND "archivedAt" IS NULL`,
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
      `SELECT "id", "name", "slug", "currency", "country" FROM "Store" WHERE "slug" = $1 AND "archivedAt" IS NULL`,
      [String(request.params.slug)],
    );
    const store = result.rows[0];
    if (!store) return response.status(404).json({ error: { code: "STORE_NOT_FOUND", message: "Store not found" } });
    response.json({ store });
  });
  return router;
}
