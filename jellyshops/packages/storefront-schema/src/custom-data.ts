import { z } from "zod";

export const dynamicScalarValueTypes = [
  "string",
  "text",
  "rich_text",
  "boolean",
  "integer",
  "decimal",
  "money",
  "color",
  "url",
  "date",
  "datetime",
  "image",
  "file",
  "product_reference",
  "collection_reference",
  "page_reference",
  "metaobject_reference",
] as const;

export type DynamicScalarValueType = typeof dynamicScalarValueTypes[number];
export type DynamicValueType = DynamicScalarValueType | `list:${DynamicScalarValueType}`;

const scalarTypeSchema = z.enum(dynamicScalarValueTypes);
const listTypeSchema = z.string().refine(
  (value): value is `list:${DynamicScalarValueType}` => {
    if (!value.startsWith("list:")) return false;
    return scalarTypeSchema.safeParse(value.slice(5)).success;
  },
  "Unsupported dynamic list value type",
);

export const dynamicValueTypeSchema = z.union([scalarTypeSchema, listTypeSchema]);

export const customDataOwnerTypeSchema = z.enum([
  "store",
  "product",
  "variant",
  "collection",
  "page",
  "blog",
  "article",
]);
export type CustomDataOwnerType = z.infer<typeof customDataOwnerTypeSchema>;

const stableHandleSchema = z.string()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9_]*$/, "Use a lowercase stable handle with letters, numbers, or underscores");

export const metafieldDefinitionSchema = z.object({
  ownerType: customDataOwnerTypeSchema,
  namespace: stableHandleSchema,
  key: stableHandleSchema,
  name: z.string().trim().min(1).max(120),
  description: z.string().max(500).optional(),
  type: dynamicValueTypeSchema,
  validations: z.record(z.string(), z.unknown()).optional(),
  storefrontVisible: z.boolean().default(false),
  origin: z.enum(["jelly", "provider"]).default("jelly"),
});
export type MetafieldDefinitionContract = z.infer<typeof metafieldDefinitionSchema>;

export const metaobjectFieldDefinitionSchema = z.object({
  handle: stableHandleSchema,
  name: z.string().trim().min(1).max(120),
  description: z.string().max(500).optional(),
  type: dynamicValueTypeSchema,
  validations: z.record(z.string(), z.unknown()).optional(),
  storefrontVisible: z.boolean().default(false),
});
export type MetaobjectFieldDefinitionContract = z.infer<typeof metaobjectFieldDefinitionSchema>;

export const metaobjectDefinitionSchema = z.object({
  handle: stableHandleSchema,
  name: z.string().trim().min(1).max(120),
  storefrontVisible: z.boolean().default(false),
  fields: z.array(metaobjectFieldDefinitionSchema).min(1),
}).superRefine((definition, context) => {
  const handles = new Set<string>();
  definition.fields.forEach((field, index) => {
    if (handles.has(field.handle)) {
      context.addIssue({
        code: "custom",
        message: "Metaobject field handles must be unique",
        path: ["fields", index, "handle"],
      });
    }
    handles.add(field.handle);
  });
});
export type MetaobjectDefinitionContract = z.infer<typeof metaobjectDefinitionSchema>;
