import { Router, type RequestHandler } from "express";
import multer from "multer";
import { z } from "zod";
import { requireMerchant, requireStorePermission } from "../auth/middleware.js";
import type { AuthProvider } from "../auth/types.js";
import { ApiError } from "../http/errors.js";
import { MAX_IMPORT_BYTES, toCsv } from "./sheet.js";
import type { ProductBulkService } from "./service.js";

const formatSchema = z.enum(["csv", "xlsx"]).default("csv");
const exportSchema = z.object({
  format: formatSchema,
  ids: z.string().max(20000).optional(),
  query: z.string().trim().min(1).max(200).optional(),
  status: z.enum(["ACTIVE", "DRAFT", "ARCHIVED"]).optional(),
  productType: z.string().trim().min(1).max(160).optional(),
  vendor: z.string().trim().min(1).max(160).optional(),
  tag: z.string().trim().min(1).max(160).optional(),
  collectionId: z.string().min(1).max(160).optional(),
  available: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
});
const checkSchema = z.object({ mapping: z.record(z.string(), z.number().int().min(0).max(200)), mode: z.enum(["create", "update", "upsert"]) }).strict();

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Merchant routes under `/api/stores/:storeId/catalog`:
 * `GET /bulk/template`, `GET /bulk/export`, and the import steps `POST /imports` (upload),
 * `POST /imports/:id/check`, `POST /imports/:id/run`, `GET /imports/:id`, `GET /imports/:id/report`,
 * `POST /imports/:id/undo`, `GET /imports`. Mounted before the catalogue router.
 */
export function createProductBulkRouter(service: ProductBulkService, authProvider: AuthProvider): Router {
  const router = Router({ mergeParams: true });
  const view = [requireMerchant(authProvider), requireStorePermission("catalog:view")];
  const edit = [requireMerchant(authProvider), requireStorePermission("catalog:edit")];
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_IMPORT_BYTES, files: 1 } }).single("file");
  // Says "too large" in plain words instead of the upload library's own message.
  const receive: RequestHandler = (request, response, next) => upload(request, response, (error: unknown) => {
    if (!error) { next(); return; }
    next((error as { code?: string }).code === "LIMIT_FILE_SIZE" ? new ApiError(413, "IMPORT_TOO_LARGE", "This file is larger than 5 MB. Split it into smaller files.") : new ApiError(400, "IMPORT_UPLOAD_FAILED", "The file could not be uploaded. Try again."));
  });
  const send = (response: Parameters<RequestHandler>[1], name: string, file: { body: Buffer; contentType: string; extension: string }) => {
    response.setHeader("Content-Type", file.contentType);
    response.setHeader("Content-Disposition", `attachment; filename="${name}.${file.extension}"`);
    response.setHeader("Cache-Control", "no-store");
    response.send(file.body);
  };

  router.get("/bulk/template", ...view, async (request, response, next) => {
    try { send(response, "jelly-products-template", await service.template(formatSchema.parse(request.query.format))); } catch (error) { next(error); }
  });

  router.get("/bulk/export", ...view, async (request, response, next) => {
    try {
      const { format, ids, ...filter } = exportSchema.parse(request.query);
      const result = await service.exportTable(request.storeContext!.storeId, { ...filter, ...(ids ? { ids: ids.split(",").map((id) => id.trim()).filter(Boolean) } : {}) });
      response.setHeader("X-Export-Products", String(result.products));
      response.setHeader("X-Export-Truncated", String(result.truncated));
      response.setHeader("Access-Control-Expose-Headers", "X-Export-Products, X-Export-Truncated, Content-Disposition");
      send(response, `products-${today()}`, await service.file(result.table, format));
    } catch (error) { next(error); }
  });

  router.get("/imports", ...view, async (request, response, next) => {
    try { response.json({ imports: await service.list(request.storeContext!.storeId) }); } catch (error) { next(error); }
  });

  router.post("/imports", ...edit, receive, async (request, response, next) => {
    try {
      const file = (request as typeof request & { file?: { originalname: string; buffer: Buffer } }).file;
      if (!file?.buffer?.length) throw new ApiError(422, "IMPORT_NO_FILE", "Choose a CSV or Excel file to upload.");
      response.status(201).json(await service.upload(request.storeContext!.storeId, request.storeContext!.userId, file.originalname, file.buffer));
    } catch (error) { next(error); }
  });

  router.get<{ importId: string }>("/imports/:importId", ...view, async (request, response, next) => {
    try { response.json(await service.get(request.storeContext!.storeId, String(request.params.importId))); } catch (error) { next(error); }
  });

  router.post<{ importId: string }>("/imports/:importId/check", ...edit, async (request, response, next) => {
    try {
      const { mapping, mode } = checkSchema.parse(request.body ?? {});
      response.json(await service.check(request.storeContext!.storeId, String(request.params.importId), mapping, mode));
    } catch (error) { next(error); }
  });

  router.post<{ importId: string }>("/imports/:importId/run", ...edit, async (request, response, next) => {
    try { response.json(await service.run(request.storeContext!.storeId, String(request.params.importId))); } catch (error) { next(error); }
  });

  router.get<{ importId: string }>("/imports/:importId/report", ...view, async (request, response, next) => {
    try {
      const table = await service.report(request.storeContext!.storeId, String(request.params.importId));
      send(response, `import-report-${today()}`, { body: Buffer.from(toCsv(table), "utf8"), contentType: "text/csv; charset=utf-8", extension: "csv" });
    } catch (error) { next(error); }
  });

  router.post<{ importId: string }>("/imports/:importId/undo", ...edit, async (request, response, next) => {
    try { response.json(await service.undo(request.storeContext!.storeId, String(request.params.importId))); } catch (error) { next(error); }
  });

  return router;
}
