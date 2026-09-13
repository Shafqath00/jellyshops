import { describe, expect, it } from "vitest";
import { compilationDiagnosticSchema } from "./diagnostics";

describe("storefront compiler diagnostics", () => {
  it("accepts a navigable field-level error", () => {
    const result = compilationDiagnosticSchema.safeParse({
      severity: "error",
      code: "DYNAMIC_SOURCE_TYPE_MISMATCH",
      message: "Hero image requires an image source",
      location: {
        entityType: "template",
        entityId: "product-default",
        sectionId: "hero-1",
        blockId: "image-block",
        fieldKey: "image",
      },
    });
    expect(result.success).toBe(true);
  });

  it("accepts warnings without a deep node location", () => {
    expect(compilationDiagnosticSchema.safeParse({
      severity: "warning",
      code: "SEO_DESCRIPTION_MISSING",
      message: "SEO description is missing",
      location: { entityType: "template", entityId: "page-default" },
    }).success).toBe(true);
  });

  it("rejects arbitrary severities and empty diagnostic codes", () => {
    expect(compilationDiagnosticSchema.safeParse({
      severity: "fatal",
      code: "",
      message: "Bad",
    }).success).toBe(false);
  });
});
