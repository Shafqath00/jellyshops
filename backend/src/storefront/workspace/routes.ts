import { Router, type Request } from "express";
import { z } from "zod";
import { requireMerchant, requireStorePermission } from "../../auth/middleware.js";
import type { AuthProvider } from "../../auth/types.js";
import { ApiError } from "../../http/errors.js";
import { templateTypes, type TemplateType } from "./repositories/template-repository.js";
import type { AssignableResourceType } from "./repositories/assignment-repository.js";
import type { MenuItem } from "./repositories/menu-repository.js";

export interface StorefrontWorkspaceApi {
  getWorkspace(storeId: string): Promise<{ generation: number; updatedAt: Date } | null>;

  listTemplates(storeId: string, type?: TemplateType): Promise<unknown[]>;
  getTemplate(storeId: string, templateId: string): Promise<unknown | null>;
  createTemplate(storeId: string, input: { type: TemplateType; name: string; handle?: string; layout: Record<string, unknown> }): Promise<unknown>;
  updateTemplate(storeId: string, templateId: string, expectedRevision: number, patch: { name?: string; handle?: string; layout?: Record<string, unknown> }): Promise<unknown>;
  cloneTemplate(storeId: string, sourceTemplateId: string, input: { name: string; handle: string }): Promise<unknown>;

  listGlobalSections(storeId: string): Promise<unknown[]>;
  getGlobalSection(storeId: string, id: string): Promise<unknown | null>;
  createGlobalSection(storeId: string, input: { name: string; section: Record<string, unknown> }): Promise<unknown>;
  updateGlobalSection(storeId: string, id: string, expectedRevision: number, patch: { name?: string; section?: Record<string, unknown> }): Promise<unknown>;
  listPresets(storeId: string): Promise<unknown[]>;
  createPreset(storeId: string, input: { name: string; section: Record<string, unknown> }): Promise<unknown>;
  instantiatePreset(storeId: string, presetId: string): Promise<Record<string, unknown>>;

  listMenus(storeId: string): Promise<unknown[]>;
  getMenu(storeId: string, id: string): Promise<unknown | null>;
  createMenu(storeId: string, input: { name: string; handle: string; items: MenuItem[] }): Promise<unknown>;
  updateMenu(storeId: string, id: string, expectedRevision: number, patch: { name?: string; handle?: string; items?: MenuItem[] }): Promise<unknown>;

  getThemeConfiguration(storeId: string): Promise<unknown | null>;
  saveThemeConfiguration(storeId: string, expectedRevision: number | null, input: { themeId: string; settings: Record<string, unknown>; draftArtifactId?: string | null }): Promise<unknown>;

  getAssignment(storeId: string, resourceType: AssignableResourceType, resourceId: string): Promise<unknown | null>;
  assignTemplate(storeId: string, input: { resourceType: AssignableResourceType; resourceId: string; templateId: string; expectedRevision: number | null }): Promise<unknown>;
}

const MAX_REVISION = 2_147_483_647;
const expectedRevisionSchema = z.number().int().nonnegative().max(MAX_REVISION);
const nullableExpectedRevisionSchema = expectedRevisionSchema.nullable();
const jsonObjectSchema = z.record(z.string(), z.unknown());
const templateTypeSchema = z.enum(templateTypes);
const assignableResourceTypeSchema = z.enum(["product", "collection", "page", "blog", "article"]);

const templateCreateSchema = z.object({
  type: templateTypeSchema,
  name: z.string().min(1),
  handle: z.string().min(1).optional(),
  layout: jsonObjectSchema,
}).strict();
const templateUpdateSchema = z.object({
  expectedRevision: expectedRevisionSchema,
  name: z.string().min(1).optional(),
  handle: z.string().min(1).optional(),
  layout: jsonObjectSchema.optional(),
}).strict();
const templateCloneSchema = z.object({ name: z.string().min(1), handle: z.string().min(1) }).strict();

const globalCreateSchema = z.object({ name: z.string().min(1), section: jsonObjectSchema }).strict();
const globalUpdateSchema = z.object({
  expectedRevision: expectedRevisionSchema,
  name: z.string().min(1).optional(),
  section: jsonObjectSchema.optional(),
}).strict();
const presetCreateSchema = globalCreateSchema;

const menuTargetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("home") }).strict(),
  z.object({ kind: z.literal("search") }).strict(),
  z.object({ kind: z.literal("product"), resourceId: z.string().min(1) }).strict(),
  z.object({ kind: z.literal("collection"), resourceId: z.string().min(1) }).strict(),
  z.object({ kind: z.literal("page"), resourceId: z.string().min(1) }).strict(),
  z.object({ kind: z.literal("blog"), resourceId: z.string().min(1) }).strict(),
  z.object({ kind: z.literal("article"), resourceId: z.string().min(1) }).strict(),
  z.object({ kind: z.literal("external"), url: z.string().min(1) }).strict(),
  z.object({ kind: z.literal("anchor"), anchor: z.string().min(1) }).strict(),
]);
type MenuItemInput = { id: string; label: string; target: z.infer<typeof menuTargetSchema>; children: MenuItemInput[] };
const menuItemSchema: z.ZodType<MenuItemInput> = z.lazy(() => z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  target: menuTargetSchema,
  children: z.array(menuItemSchema),
}).strict());
const menuCreateSchema = z.object({ name: z.string().min(1), handle: z.string().min(1), items: z.array(menuItemSchema) }).strict();
const menuUpdateSchema = z.object({
  expectedRevision: expectedRevisionSchema,
  name: z.string().min(1).optional(),
  handle: z.string().min(1).optional(),
  items: z.array(menuItemSchema).optional(),
}).strict();

const themeSaveSchema = z.object({
  expectedRevision: nullableExpectedRevisionSchema,
  themeId: z.string().min(1),
  settings: jsonObjectSchema,
  draftArtifactId: z.string().min(1).nullable().optional(),
}).strict();
const assignmentSaveSchema = z.object({
  templateId: z.string().min(1),
  expectedRevision: nullableExpectedRevisionSchema,
}).strict();

function storeId(request: Request): string {
  return request.storeContext!.storeId;
}

function notFound(resource: string): never {
  throw new ApiError(404, "STOREFRONT_RESOURCE_NOT_FOUND", `${resource} was not found`);
}

function withoutExpectedRevision<T extends { expectedRevision: number }>(value: T): Omit<T, "expectedRevision"> {
  const { expectedRevision: _expectedRevision, ...rest } = value;
  return rest;
}

export function createStorefrontWorkspaceRouter(api: StorefrontWorkspaceApi, authProvider: AuthProvider): Router {
  const router = Router({ mergeParams: true });
  router.use(requireMerchant(authProvider));

  router.get("/workspace", requireStorePermission("storefront:view"), async (request, response, next) => {
    try {
      const workspace = await api.getWorkspace(storeId(request));
      response.json(workspace ?? { generation: 0, updatedAt: null });
    } catch (error) { next(error); }
  });

  router.get("/templates", requireStorePermission("storefront:view"), async (request, response, next) => {
    try {
      const type = request.query.type === undefined ? undefined : templateTypeSchema.parse(request.query.type);
      response.json(await api.listTemplates(storeId(request), type));
    } catch (error) { next(error); }
  });
  router.get("/templates/:templateId", requireStorePermission("storefront:view"), async (request, response, next) => {
    try { response.json(await api.getTemplate(storeId(request), String(request.params.templateId)) ?? notFound("Template")); }
    catch (error) { next(error); }
  });
  router.post("/templates", requireStorePermission("storefront:edit"), async (request, response, next) => {
    try { response.status(201).json(await api.createTemplate(storeId(request), templateCreateSchema.parse(request.body))); }
    catch (error) { next(error); }
  });
  router.patch("/templates/:templateId", requireStorePermission("storefront:edit"), async (request, response, next) => {
    try {
      const input = templateUpdateSchema.parse(request.body);
      response.json(await api.updateTemplate(storeId(request), String(request.params.templateId), input.expectedRevision, withoutExpectedRevision(input)));
    } catch (error) { next(error); }
  });
  router.post("/templates/:templateId/clone", requireStorePermission("storefront:edit"), async (request, response, next) => {
    try { response.status(201).json(await api.cloneTemplate(storeId(request), String(request.params.templateId), templateCloneSchema.parse(request.body))); }
    catch (error) { next(error); }
  });

  router.get("/global-sections", requireStorePermission("storefront:view"), async (request, response, next) => {
    try { response.json(await api.listGlobalSections(storeId(request))); } catch (error) { next(error); }
  });
  router.get("/global-sections/:sectionId", requireStorePermission("storefront:view"), async (request, response, next) => {
    try { response.json(await api.getGlobalSection(storeId(request), String(request.params.sectionId)) ?? notFound("Global section")); }
    catch (error) { next(error); }
  });
  router.post("/global-sections", requireStorePermission("storefront:edit"), async (request, response, next) => {
    try { response.status(201).json(await api.createGlobalSection(storeId(request), globalCreateSchema.parse(request.body))); }
    catch (error) { next(error); }
  });
  router.patch("/global-sections/:sectionId", requireStorePermission("storefront:edit"), async (request, response, next) => {
    try {
      const input = globalUpdateSchema.parse(request.body);
      response.json(await api.updateGlobalSection(storeId(request), String(request.params.sectionId), input.expectedRevision, withoutExpectedRevision(input)));
    } catch (error) { next(error); }
  });

  router.get("/presets", requireStorePermission("storefront:view"), async (request, response, next) => {
    try { response.json(await api.listPresets(storeId(request))); } catch (error) { next(error); }
  });
  router.post("/presets", requireStorePermission("storefront:edit"), async (request, response, next) => {
    try { response.status(201).json(await api.createPreset(storeId(request), presetCreateSchema.parse(request.body))); }
    catch (error) { next(error); }
  });
  router.post("/presets/:presetId/instantiate", requireStorePermission("storefront:edit"), async (request, response, next) => {
    try { response.json(await api.instantiatePreset(storeId(request), String(request.params.presetId))); }
    catch (error) { next(error); }
  });

  router.get("/menus", requireStorePermission("storefront:view"), async (request, response, next) => {
    try { response.json(await api.listMenus(storeId(request))); } catch (error) { next(error); }
  });
  router.get("/menus/:menuId", requireStorePermission("storefront:view"), async (request, response, next) => {
    try { response.json(await api.getMenu(storeId(request), String(request.params.menuId)) ?? notFound("Menu")); }
    catch (error) { next(error); }
  });
  router.post("/menus", requireStorePermission("storefront:edit"), async (request, response, next) => {
    try { response.status(201).json(await api.createMenu(storeId(request), menuCreateSchema.parse(request.body) as { name: string; handle: string; items: MenuItem[] })); }
    catch (error) { next(error); }
  });
  router.patch("/menus/:menuId", requireStorePermission("storefront:edit"), async (request, response, next) => {
    try {
      const input = menuUpdateSchema.parse(request.body);
      response.json(await api.updateMenu(storeId(request), String(request.params.menuId), input.expectedRevision, withoutExpectedRevision(input) as { name?: string; handle?: string; items?: MenuItem[] }));
    } catch (error) { next(error); }
  });

  router.get("/theme-settings", requireStorePermission("storefront:view"), async (request, response, next) => {
    try { response.json(await api.getThemeConfiguration(storeId(request))); } catch (error) { next(error); }
  });
  router.put("/theme-settings", requireStorePermission("storefront:edit"), async (request, response, next) => {
    try {
      const { expectedRevision, ...input } = themeSaveSchema.parse(request.body);
      response.json(await api.saveThemeConfiguration(storeId(request), expectedRevision, input));
    } catch (error) { next(error); }
  });

  router.get("/assignments/:resourceType/:resourceId", requireStorePermission("storefront:view"), async (request, response, next) => {
    try {
      const resourceType = assignableResourceTypeSchema.parse(request.params.resourceType);
      response.json(await api.getAssignment(storeId(request), resourceType, String(request.params.resourceId)));
    } catch (error) { next(error); }
  });
  router.put("/assignments/:resourceType/:resourceId", requireStorePermission("storefront:edit"), async (request, response, next) => {
    try {
      const resourceType = assignableResourceTypeSchema.parse(request.params.resourceType);
      const input = assignmentSaveSchema.parse(request.body);
      response.json(await api.assignTemplate(storeId(request), {
        resourceType,
        resourceId: String(request.params.resourceId),
        templateId: input.templateId,
        expectedRevision: input.expectedRevision,
      }));
    } catch (error) { next(error); }
  });

  return router;
}
