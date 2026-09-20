import { Router } from "express";
import { z } from "zod";
import { requireMerchant, requireStorePermission } from "../auth/middleware.js";
import type { AuthProvider } from "../auth/types.js";
import { getDemoCatalog } from "./demo-catalog-provider.js";
import type { CatalogAdmin } from "./service.js";

const productStatusSchema = z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]);
const listSchema = z.object({
  query: z.string().trim().min(1).optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
const productListSchema = listSchema.extend({
  collectionId: z.string().min(1).optional(),
  status: productStatusSchema.optional(),
});
const variantSchema = z.object({
  id: z.string().min(1).optional(),
  title: z.string().trim().min(1),
  sku: z.string().trim().min(1).nullable().optional(),
  priceMinor: z.number().int().nonnegative(),
  compareAtPriceMinor: z.number().int().nonnegative().nullable().optional(),
  options: z.record(z.string(), z.unknown()).optional(),
  trackInventory: z.boolean().optional(),
  quantity: z.number().int().nonnegative().nullable().optional(),
  reserved: z.number().int().nonnegative().nullable().optional(),
});
const createProductSchema = z.object({
  handle: z.string().trim().min(1),
  title: z.string().trim().min(1),
  description: z.string().optional(),
  vendor: z.string().trim().min(1).nullable().optional(),
  productType: z.string().trim().min(1).nullable().optional(),
  tags: z.array(z.string().trim().min(1)).optional(),
  status: productStatusSchema.optional(),
  variants: z.array(variantSchema.omit({ id: true })).optional(),
  primaryCategoryId: z.string().min(1).nullable().optional(),
  additionalCategoryIds: z.array(z.string().min(1)).optional(),
  brandId: z.string().min(1).nullable().optional(),
  collectionIds: z.array(z.string().min(1)).optional(),
  options: z.array(z.unknown()).optional(),
  inventoryOptionIds: z.array(z.string().min(1)).optional(),
  categoryMetadata: z.unknown().nullable().optional(),
  brandMetadata: z.unknown().nullable().optional(),
  collectionMetadata: z.array(z.unknown()).optional(),
});
const updateProductSchema = createProductSchema.partial().extend({
  variants: z.array(variantSchema).optional(),
});
const createCollectionSchema = z.object({
  handle: z.string().trim().min(1),
  title: z.string().trim().min(1),
  description: z.string().optional(),
  productIds: z.array(z.string().min(1)).optional(),
});
const updateCollectionSchema = createCollectionSchema.partial();

type AdminCatalogService = Pick<
  CatalogAdmin,
  "listProducts" | "getProduct" | "createProduct" | "updateProduct" |
  "listCollections" | "createCollection" | "updateCollection"
>;
type PublicCatalogService = Pick<CatalogAdmin, "listPublicProducts" | "listCollections">;

export function createCatalogRouter(): Router {
  const router = Router();
  router.get("/", (_request, response) => response.json(getDemoCatalog()));
  return router;
}

export function createCatalogAdminRouter(service: AdminCatalogService, authProvider: AuthProvider): Router {
  const router = Router({ mergeParams: true });
  router.use(requireMerchant(authProvider));

  router.get("/products", requireStorePermission("catalog:view"), async (request, response) => {
    const input = productListSchema.parse(request.query);
    response.json(await service.listProducts(request.storeContext!.storeId, input));
  });

  router.get("/products/:productId", requireStorePermission("catalog:view"), async (request, response) => {
    response.json(await service.getProduct(request.storeContext!.storeId, String(request.params.productId)));
  });

  router.post("/products", requireStorePermission("catalog:edit"), async (request, response) => {
    const input = createProductSchema.parse(request.body);
    response.status(201).json(await service.createProduct(request.storeContext!.storeId, input));
  });

  router.patch("/products/:productId", requireStorePermission("catalog:edit"), async (request, response) => {
    const input = updateProductSchema.parse(request.body);
    response.json(await service.updateProduct(request.storeContext!.storeId, String(request.params.productId), input));
  });

  router.get("/collections", requireStorePermission("catalog:view"), async (request, response) => {
    const input = listSchema.parse(request.query);
    response.json(await service.listCollections(request.storeContext!.storeId, input));
  });

  router.post("/collections", requireStorePermission("catalog:edit"), async (request, response) => {
    const input = createCollectionSchema.parse(request.body);
    response.status(201).json(await service.createCollection(request.storeContext!.storeId, input));
  });

  router.patch("/collections/:collectionId", requireStorePermission("catalog:edit"), async (request, response) => {
    const input = updateCollectionSchema.parse(request.body);
    response.json(await service.updateCollection(request.storeContext!.storeId, String(request.params.collectionId), input));
  });

  return router;
}

export function createPublicCatalogRouter(service: PublicCatalogService): Router {
  const router = Router({ mergeParams: true });
  router.get<{ storeId: string }>("/products", async (request, response) => {
    const { status: _status, ...input } = productListSchema.parse(request.query);
    response.json(await service.listPublicProducts(String(request.params.storeId), input));
  });
  router.get<{ storeId: string }>("/collections", async (request, response) => {
    response.json(await service.listCollections(String(request.params.storeId), listSchema.parse(request.query)));
  });
  return router;
}
