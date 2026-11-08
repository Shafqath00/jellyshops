import { Router } from "express";
import { z } from "zod";
import { requireMerchant, requireStorePermission } from "../auth/middleware.js";
import type { AuthProvider } from "../auth/types.js";
import type { TaxonomyService } from "./service.js";

const nameSchema = z.string().trim().min(1).max(80);
const templateFields = {
  name: nameSchema,
  optionKind: z.enum(["variant", "configuration", "addon"]),
  displayType: z.enum(["buttons", "dropdown", "color", "image"]),
  required: z.boolean(),
  multiple: z.boolean(),
  defaultValues: z.array(z.string().trim().min(1).max(80)).max(100),
};
const createCategorySchema = z.object({ name: nameSchema, parentId: z.string().min(1).nullable().optional() });
const updateCategorySchema = z.object({ name: nameSchema.optional(), parentId: z.string().min(1).nullable().optional(), position: z.number().int().min(0).max(10000).optional() }).refine((value) => Object.keys(value).length > 0, { message: "Nothing to update" });
const createTemplateSchema = z.object({ ...templateFields, optionKind: templateFields.optionKind.default("configuration"), displayType: templateFields.displayType.default("buttons"), required: templateFields.required.default(false), multiple: templateFields.multiple.default(false), defaultValues: templateFields.defaultValues.default([]) });
const updateTemplateSchema = z.object(templateFields).partial().refine((value) => Object.keys(value).length > 0, { message: "Nothing to update" });

type Dependencies = Pick<TaxonomyService, "tree" | "createCategory" | "updateCategory" | "archiveCategory" | "createTemplate" | "updateTemplate" | "deleteTemplate">;

export function createTaxonomyRouter(service: Dependencies, authProvider: AuthProvider): Router {
  const router = Router({ mergeParams: true });
  router.use(requireMerchant(authProvider));
  const storeId = (request: { storeContext?: { storeId: string } }) => request.storeContext!.storeId;

  router.get("/categories", requireStorePermission("catalog:view"), async (request, response) => {
    response.json(await service.tree(storeId(request)));
  });
  router.post("/categories", requireStorePermission("catalog:edit"), async (request, response) => {
    response.status(201).json(await service.createCategory(storeId(request), createCategorySchema.parse(request.body)));
  });
  router.patch("/categories/:categoryId", requireStorePermission("catalog:edit"), async (request, response) => {
    response.json(await service.updateCategory(storeId(request), String(request.params.categoryId), updateCategorySchema.parse(request.body)));
  });
  router.delete("/categories/:categoryId", requireStorePermission("catalog:edit"), async (request, response) => {
    await service.archiveCategory(storeId(request), String(request.params.categoryId));
    response.status(204).end();
  });
  router.post("/categories/:categoryId/templates", requireStorePermission("catalog:edit"), async (request, response) => {
    response.status(201).json(await service.createTemplate(storeId(request), String(request.params.categoryId), createTemplateSchema.parse(request.body)));
  });
  router.patch("/templates/:templateId", requireStorePermission("catalog:edit"), async (request, response) => {
    response.json(await service.updateTemplate(storeId(request), String(request.params.templateId), updateTemplateSchema.parse(request.body)));
  });
  router.delete("/templates/:templateId", requireStorePermission("catalog:edit"), async (request, response) => {
    await service.deleteTemplate(storeId(request), String(request.params.templateId));
    response.status(204).end();
  });
  return router;
}
