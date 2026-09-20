import { z } from "zod";

export const RUNTIME_STOREFRONT_SCHEMA_VERSION = 4 as const;

const jsonObjectSchema = z.record(z.string(), z.unknown());
const runtimeTemplateTypeSchema = z.enum([
  "home",
  "product",
  "collection",
  "page",
  "blog",
  "article",
  "search",
  "cart",
]);
const assignableResourceTypeSchema = z.enum(["product", "collection", "page", "blog", "article"]);

const runtimeTemplateSchema = z.object({
  id: z.string().min(1),
  type: runtimeTemplateTypeSchema,
  handle: z.string().min(1),
  layout: jsonObjectSchema,
}).strict();

const runtimeGlobalSectionSchema = z.object({
  id: z.string().min(1),
  section: jsonObjectSchema,
}).strict();

const runtimeMenuTargetSchema = z.discriminatedUnion("kind", [
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

type RuntimeMenuItemInput = {
  id: string;
  label: string;
  target: z.infer<typeof runtimeMenuTargetSchema>;
  children: RuntimeMenuItemInput[];
};

const runtimeMenuItemSchema: z.ZodType<RuntimeMenuItemInput> = z.lazy(() => z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  target: runtimeMenuTargetSchema,
  children: z.array(runtimeMenuItemSchema),
}).strict());

const runtimeMenuSchema = z.object({
  id: z.string().min(1),
  handle: z.string().min(1),
  items: z.array(runtimeMenuItemSchema),
}).strict();

const runtimeTemplateAssignmentSchema = z.object({
  resourceType: assignableResourceTypeSchema,
  resourceId: z.string().min(1),
  templateId: z.string().min(1),
}).strict();

const dependencyEndpointSchema = z.object({
  type: z.enum([
    "theme",
    "template",
    "global_section",
    "menu",
    "assignment",
    "media",
    "resource",
    "metafield_definition",
    "metaobject_definition",
    "extension",
  ]),
  id: z.string().min(1),
}).strict();

const dependencyEdgeSchema = z.object({
  from: dependencyEndpointSchema,
  to: dependencyEndpointSchema,
  reason: z.enum(["placement", "binding", "navigation", "template_assignment", "media", "extension"]),
}).strict();

export const runtimeStorefrontSnapshotV4Schema = z.object({
  schemaVersion: z.literal(RUNTIME_STOREFRONT_SCHEMA_VERSION),
  storeId: z.string().min(1),
  sourceGeneration: z.number().int().nonnegative(),
  compilerVersion: z.string().min(1),
  registryManifestHash: z.string().min(1),
  theme: z.object({
    presetId: z.string().min(1),
    id: z.string().min(1).optional(),
    version: z.string().min(1).optional(),
    settings: jsonObjectSchema,
    artifactId: z.string().min(1).nullable(),
    fallbackReason: z.enum(["theme-unavailable", "version-unavailable"]).optional(),
  }).strict(),
  templates: z.record(z.string().min(1), runtimeTemplateSchema),
  globalSections: z.record(z.string().min(1), runtimeGlobalSectionSchema),
  menus: z.record(z.string().min(1), runtimeMenuSchema),
  templateDefaults: z.partialRecord(runtimeTemplateTypeSchema, z.string().min(1)),
  assignments: z.array(runtimeTemplateAssignmentSchema),
  dependencies: z.object({
    edges: z.array(dependencyEdgeSchema),
  }).strict(),
}).strict();

export type RuntimeStorefrontSnapshotV4 = z.infer<typeof runtimeStorefrontSnapshotV4Schema>;
export type RuntimeTemplateV4 = z.infer<typeof runtimeTemplateSchema>;
export type RuntimeGlobalSectionV4 = z.infer<typeof runtimeGlobalSectionSchema>;
export type RuntimeMenuV4 = z.infer<typeof runtimeMenuSchema>;
export type RuntimeTemplateAssignmentV4 = z.infer<typeof runtimeTemplateAssignmentSchema>;
export type RuntimeDependencyEdgeV4 = z.infer<typeof dependencyEdgeSchema>;
