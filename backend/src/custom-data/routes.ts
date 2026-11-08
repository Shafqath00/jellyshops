import { Router } from "express";
import { z } from "zod";
import { requireMerchant, requireStorePermission } from "../auth/middleware.js";
import type { AuthProvider } from "../auth/types.js";
import { dynamicValueTypeSchema, metafieldDefinitionSchema, metaobjectDefinitionSchema } from "@jelly/storefront-schema";
import type { CustomDataService, MetaobjectService } from "./service.js";
import type { OwnerMetafieldService } from "./owner-values.js";
import type { DynamicSourceRegistry, TemplateContext } from "../dynamic-sources/registry.js";

const ownerTypeSchema = z.enum(["store", "product", "variant", "collection", "page", "blog", "article"]);
const contextSchema = z.enum(["home", "product", "collection", "page", "blog", "article", "search", "cart"]);
const definitionPatchSchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().optional(),
  validations: z.record(z.string(), z.unknown()).optional(),
  storefrontVisible: z.boolean().optional(),
});
const entrySchema = z.object({
  handle: z.string().min(1),
  displayName: z.string().trim().min(1),
  values: z.record(z.string(), z.unknown()),
});
const entryPatchSchema = z.object({
  displayName: z.string().trim().min(1).optional(),
  values: z.record(z.string(), z.unknown()).optional(),
});

type CustomDataRoutesDependencies = {
  customData: Pick<CustomDataService,
    "createMetafieldDefinition" | "listMetafieldDefinitions" | "updateMetafieldDefinition" | "setMetafieldValue">;
  metaobjects: Pick<MetaobjectService,
    "createDefinition" | "listDefinitions" | "updateDefinition" | "createEntry" | "listEntries" | "updateEntry">;
  registry: Pick<DynamicSourceRegistry, "listDynamicSources">;
  /** Values of one kind of item at a time (a product and its variants), for the product editor. */
  ownerValues?: Pick<OwnerMetafieldService, "list" | "save">;
};

export function createCustomDataRouter(
  dependencies: CustomDataRoutesDependencies,
  authProvider: AuthProvider,
): Router {
  const router = Router({ mergeParams: true });
  router.use(requireMerchant(authProvider));

  router.get("/dynamic-sources", requireStorePermission("storefront:view"), async (request, response) => {
    const context = contextSchema.parse(request.query.context) as TemplateContext;
    const accepts = typeof request.query.accepts === "string" && request.query.accepts.length > 0
      ? request.query.accepts.split(",").map((value) => dynamicValueTypeSchema.parse(value))
      : undefined;
    response.json(await dependencies.registry.listDynamicSources(request.storeContext!.storeId, context, accepts));
  });

  router.get("/metafields", requireStorePermission("storefront:view"), async (request, response) => {
    const ownerType = ownerTypeSchema.parse(request.query.ownerType);
    response.json(await dependencies.customData.listMetafieldDefinitions(request.storeContext!.storeId, ownerType));
  });

  router.post("/metafields", requireStorePermission("custom_data:edit"), async (request, response) => {
    const { storeId: _ignored, ...body } = request.body ?? {};
    const input = metafieldDefinitionSchema.parse(body);
    response.status(201).json(await dependencies.customData.createMetafieldDefinition(request.storeContext!.storeId, input));
  });

  router.patch("/metafields/:definitionId", requireStorePermission("custom_data:edit"), async (request, response) => {
    response.json(await dependencies.customData.updateMetafieldDefinition(
      request.storeContext!.storeId,
      String(request.params.definitionId),
      definitionPatchSchema.parse(request.body),
    ));
  });

  router.get("/metafield-values", requireStorePermission("storefront:view"), async (request, response) => {
    const query = z.object({ ownerType: ownerTypeSchema, ownerId: z.string().min(1).max(200).optional(), ownerIds: z.string().min(1).max(20_000).optional() }).parse(request.query);
    const ids = query.ownerIds ? query.ownerIds.split(",").map((id) => id.trim()).filter(Boolean) : query.ownerId ? [query.ownerId] : [];
    if (ids.length === 0) { response.status(400).json({ error: { code: "OWNER_REQUIRED", message: "Say which items to load values for." } }); return; }
    if (!dependencies.ownerValues) { response.status(503).json({ error: { code: "UNAVAILABLE", message: "Custom data is unavailable." } }); return; }
    response.json({ values: await dependencies.ownerValues.list(request.storeContext!.storeId, query.ownerType, ids) });
  });

  router.put("/metafield-values", requireStorePermission("custom_data:edit"), async (request, response) => {
    const body = z.object({ ownerType: ownerTypeSchema, ownerId: z.string().min(1).max(200), values: z.record(z.string().min(1).max(200), z.unknown()) }).strict().parse(request.body);
    if (!dependencies.ownerValues) { response.status(503).json({ error: { code: "UNAVAILABLE", message: "Custom data is unavailable." } }); return; }
    response.json(await dependencies.ownerValues.save(request.storeContext!.storeId, body.ownerType, body.ownerId, body.values));
  });

  router.put("/metafields/:definitionId/owners/:ownerId", requireStorePermission("custom_data:edit"), async (request, response) => {
    const body = z.object({ value: z.unknown() }).parse(request.body);
    response.json(await dependencies.customData.setMetafieldValue(
      request.storeContext!.storeId,
      String(request.params.definitionId),
      String(request.params.ownerId),
      body.value,
    ));
  });

  router.get("/metaobjects", requireStorePermission("storefront:view"), async (request, response) => {
    response.json(await dependencies.metaobjects.listDefinitions(request.storeContext!.storeId));
  });

  router.post("/metaobjects", requireStorePermission("custom_data:edit"), async (request, response) => {
    const { storeId: _ignored, ...body } = request.body ?? {};
    response.status(201).json(await dependencies.metaobjects.createDefinition(
      request.storeContext!.storeId,
      metaobjectDefinitionSchema.parse(body),
    ));
  });

  router.patch("/metaobjects/:definitionId", requireStorePermission("custom_data:edit"), async (request, response) => {
    response.json(await dependencies.metaobjects.updateDefinition(
      request.storeContext!.storeId,
      String(request.params.definitionId),
      metaobjectDefinitionSchema.omit({ handle: true }).partial().parse(request.body),
    ));
  });

  router.get("/metaobjects/:definitionId/entries", requireStorePermission("storefront:view"), async (request, response) => {
    response.json(await dependencies.metaobjects.listEntries(
      request.storeContext!.storeId,
      String(request.params.definitionId),
    ));
  });

  router.post("/metaobjects/:definitionId/entries", requireStorePermission("custom_data:edit"), async (request, response) => {
    response.status(201).json(await dependencies.metaobjects.createEntry(
      request.storeContext!.storeId,
      String(request.params.definitionId),
      entrySchema.parse(request.body),
    ));
  });

  router.patch("/metaobject-entries/:entryId", requireStorePermission("custom_data:edit"), async (request, response) => {
    response.json(await dependencies.metaobjects.updateEntry(
      request.storeContext!.storeId,
      String(request.params.entryId),
      entryPatchSchema.parse(request.body),
    ));
  });

  return router;
}
