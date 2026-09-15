import { describe, expect, it } from "vitest";
import {
  dynamicValueTypeSchema,
  metafieldDefinitionSchema,
  metaobjectDefinitionSchema,
} from "./custom-data.js";

describe("custom data schemas", () => {
  it("accepts supported scalar, reference, and list value types", () => {
    for (const value of [
      "string",
      "rich_text",
      "money",
      "image",
      "product_reference",
      "metaobject_reference",
      "list:string",
      "list:product_reference",
    ]) {
      expect(dynamicValueTypeSchema.parse(value)).toBe(value);
    }
  });

  it("rejects unsupported list element types", () => {
    expect(() => dynamicValueTypeSchema.parse("list:money:invalid")).toThrow();
    expect(() => dynamicValueTypeSchema.parse("list:javascript")).toThrow();
  });

  it("validates stable metafield identifiers separately from display labels", () => {
    expect(metafieldDefinitionSchema.parse({
      ownerType: "product",
      namespace: "details",
      key: "material",
      name: "Material",
      type: "string",
      storefrontVisible: true,
      origin: "jelly",
    })).toMatchObject({ namespace: "details", key: "material" });
    expect(() => metafieldDefinitionSchema.parse({
      ownerType: "product",
      namespace: "Details With Spaces",
      key: "material",
      name: "Material",
      type: "string",
      storefrontVisible: true,
      origin: "jelly",
    })).toThrow();
  });

  it("validates metaobject definitions with stable unique field handles", () => {
    expect(metaobjectDefinitionSchema.parse({
      handle: "brand",
      name: "Brand",
      storefrontVisible: true,
      fields: [
        { handle: "name", name: "Name", type: "string", storefrontVisible: true },
        { handle: "logo", name: "Logo", type: "image", storefrontVisible: true },
      ],
    }).fields).toHaveLength(2);

    expect(() => metaobjectDefinitionSchema.parse({
      handle: "brand",
      name: "Brand",
      storefrontVisible: true,
      fields: [
        { handle: "name", name: "Name", type: "string", storefrontVisible: true },
        { handle: "name", name: "Duplicate", type: "string", storefrontVisible: true },
      ],
    })).toThrow(/unique/i);
  });
});
