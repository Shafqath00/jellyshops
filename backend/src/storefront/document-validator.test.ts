import { describe, expect, it } from "vitest";
import { createDefaultStoreDesign, createDefaultStorefrontDocument } from "@jelly/storefront-schema";
import { storefrontDocumentValidator } from "./document-validator.js";

describe("shared storefront validator", () => {
  it("accepts V1 documents through migration", () => {
    const parsed = storefrontDocumentValidator.parse(createDefaultStoreDesign(), "store-demo");
    expect(parsed).toMatchObject({ schemaVersion: 2, storeId: "store-demo", template: "home" });
  });

  it("returns schema issue paths for invalid media", () => {
    const document = createDefaultStorefrontDocument("store-demo");
    document.regions.template[0].settings.image = {
      id: "image-1",
      url: "javascript:alert(1)",
      alt: "Unsafe",
      focalPoint: { x: 50, y: 50 },
      fit: "cover",
    };

    expect(() => storefrontDocumentValidator.parse(document, "store-demo")).toThrowError(
      expect.objectContaining({ issues: expect.arrayContaining([expect.objectContaining({ message: "Media URL uses an unsafe protocol" })]) }),
    );
  });
});
