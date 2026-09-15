import { z } from "zod";
import type { DynamicValueType } from "./custom-data.js";

export const dynamicResourceTypeSchema = z.enum([
  "store",
  "product",
  "variant",
  "collection",
  "page",
  "blog",
  "article",
]);
export type DynamicResourceType = z.infer<typeof dynamicResourceTypeSchema>;

const stablePathPartSchema = z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/);

const resourceFieldBindingSchema = z.object({
  kind: z.literal("resource_field"),
  resource: dynamicResourceTypeSchema,
  field: stablePathPartSchema,
});

const metafieldBindingSchema = z.object({
  kind: z.literal("metafield"),
  resource: dynamicResourceTypeSchema,
  namespace: z.string().min(1).max(64).regex(/^[a-z][a-z0-9_]*$/),
  key: z.string().min(1).max(64).regex(/^[a-z][a-z0-9_]*$/),
});

export type DynamicBinding =
  | z.infer<typeof resourceFieldBindingSchema>
  | z.infer<typeof metafieldBindingSchema>
  | {
      kind: "metaobject_field";
      source: DynamicBinding;
      field: string;
    };

export const dynamicBindingSchema: z.ZodType<DynamicBinding> = z.lazy(() => z.discriminatedUnion("kind", [
  resourceFieldBindingSchema,
  metafieldBindingSchema,
  z.object({
    kind: z.literal("metaobject_field"),
    source: dynamicBindingSchema,
    field: stablePathPartSchema,
  }),
]));

export function isDynamicValueTypeCompatible(
  expected: DynamicValueType,
  actual: DynamicValueType,
): boolean {
  return expected === actual;
}

export function settingValueSchema<T extends z.ZodTypeAny>(valueSchema: T) {
  return z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("static"),
      value: valueSchema,
    }),
    z.object({
      kind: z.literal("dynamic"),
      binding: dynamicBindingSchema,
      fallback: valueSchema.optional(),
    }),
  ]);
}

export type SettingValue<T> =
  | { kind: "static"; value: T }
  | { kind: "dynamic"; binding: DynamicBinding; fallback?: T };
