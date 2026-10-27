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
  categoryId: z.string().min(1).max(160).optional(),
  minPriceMinor: z.coerce.number().int().nonnegative().max(2147483647).optional(),
  maxPriceMinor: z.coerce.number().int().nonnegative().max(2147483647).optional(),
  available: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
  sort: z.enum(["id", "newest", "price-asc", "price-desc", "title-asc", "best-selling"]).optional(),
  variantOptions: z.preprocess((raw) => { if (typeof raw !== "string") return raw; try { return JSON.parse(raw); } catch { return null; } }, z.record(z.string().min(1).max(160), z.string().min(1).max(160)).refine((value) => Object.keys(value).length <= 20)).optional(),
  collectionId: z.string().min(1).optional(),
  status: productStatusSchema.optional(),
}).refine((value) => value.minPriceMinor === undefined || value.maxPriceMinor === undefined || value.minPriceMinor <= value.maxPriceMinor, { message: "Minimum price must not exceed maximum price", path: ["minPriceMinor"] });
const UNIT_DIMENSION: Record<string, string> = { mg: "mass", g: "mass", kg: "mass", ml: "volume", cl: "volume", l: "volume", mm: "length", cm: "length", m: "length", m2: "area", item: "count" };
const unitPricingSchema = z.object({
  totalAmount: z.number().positive().max(1_000_000),
  totalUnit: z.string().refine((unit) => unit in UNIT_DIMENSION, "Unknown unit"),
  baseAmount: z.number().positive().max(1_000_000),
  baseUnit: z.string().refine((unit) => unit in UNIT_DIMENSION, "Unknown unit"),
}).refine((value) => UNIT_DIMENSION[value.totalUnit] === UNIT_DIMENSION[value.baseUnit], { message: "Measurement and price-per units must measure the same thing", path: ["baseUnit"] });
const variantSchema = z.object({
  id: z.string().min(1).optional(),
  title: z.string().trim().min(1),
  sku: z.string().trim().min(1).nullable().optional(),
  priceMinor: z.number().int().nonnegative(),
  compareAtPriceMinor: z.number().int().nonnegative().nullable().optional(),
  costMinor: z.number().int().nonnegative().nullable().optional(),
  unitPricing: unitPricingSchema.nullable().optional(),
  options: z.record(z.string(), z.unknown()).optional(),
  trackInventory: z.boolean().optional(),
  quantity: z.number().int().nonnegative().nullable().optional(),
  reserved: z.number().int().nonnegative().nullable().optional(),
});
const createProductSchema = z.object({
  imageUrl: z.string().url().optional(),
  handle: z.string().trim().min(1),
  title: z.string().trim().min(1),
  description: z.string().optional(),
  specifications: z.record(z.string().trim().min(1).max(80), z.string().trim().min(1).max(500)).refine((value) => Object.keys(value).length <= 50).optional(),
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
  "listCollections" | "getCollection" | "createCollection" | "updateCollection"
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

  router.get("/collections/:collectionId", requireStorePermission("catalog:view"), async (request, response) => {
    response.json(await service.getCollection(request.storeContext!.storeId, String(request.params.collectionId)));
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
