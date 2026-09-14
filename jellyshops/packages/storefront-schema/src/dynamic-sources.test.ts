import { describe, expect, it } from "vitest";
import {
  dynamicBindingSchema,
  isDynamicValueTypeCompatible,
  settingValueSchema,
} from "./dynamic-sources.js";
import { z } from "zod";

describe("dynamic source schemas", () => {
  it("accepts structured resource, metafield, and metaobject-field bindings", () => {
    expect(dynamicBindingSchema.parse({
      kind: "resource_field",
      resource: "product",
      field: "title",
    })).toMatchObject({ kind: "resource_field", resource: "product" });

    expect(dynamicBindingSchema.parse({
      kind: "metafield",
      resource: "product",
      namespace: "details",
      key: "material",
    })).toMatchObject({ kind: "metafield", key: "material" });

    expect(dynamicBindingSchema.parse({
      kind: "metaobject_field",
      source: {
        kind: "metafield",
        resource: "product",
        namespace: "details",
        key: "brand",
      },
      field: "logo",
    })).toMatchObject({ kind: "metaobject_field", field: "logo" });
  });

  it("rejects expression strings and arbitrary evaluators", () => {
    expect(() => dynamicBindingSchema.parse("{{ product.title }}")).toThrow();
    expect(() => dynamicBindingSchema.parse({
      kind: "expression",
      code: "product.price * 0.8",
    })).toThrow();
  });

  it("enforces explicit type compatibility", () => {
    expect(isDynamicValueTypeCompatible("string", "string")).toBe(true);
    expect(isDynamicValueTypeCompatible("image", "image")).toBe(true);
    expect(isDynamicValueTypeCompatible("image", "string")).toBe(false);
    expect(isDynamicValueTypeCompatible("collection_reference", "product_reference")).toBe(false);
  });

  it("supports static values or structured dynamic values with typed fallbacks", () => {
    const schema = settingValueSchema(z.string());
    expect(schema.parse({ kind: "static", value: "Hello" })).toEqual({ kind: "static", value: "Hello" });
    expect(schema.parse({
      kind: "dynamic",
      binding: { kind: "resource_field", resource: "product", field: "title" },
      fallback: "Fallback",
    })).toMatchObject({ kind: "dynamic", fallback: "Fallback" });
    expect(() => schema.parse({
      kind: "dynamic",
      binding: { kind: "resource_field", resource: "product", field: "title" },
      fallback: 42,
    })).toThrow();
  });
});
