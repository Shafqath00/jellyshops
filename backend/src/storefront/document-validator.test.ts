import { describe, expect, it } from "vitest";
import { createDefaultStoreDesign, createDefaultStorefrontDocument } from "@jelly/storefront-schema";
import { storefrontDocumentValidator } from "./document-validator.js";

describe("shared storefront validator", () => {
  it("migrates legacy documents into the current V3 shape", () => {
    const parsed = storefrontDocumentValidator.parse(createDefaultStoreDesign(), "store-demo");
    expect(parsed).toMatchObject({ schemaVersion: 3, storeId: "store-demo" });
    expect(parsed.pages).toEqual(expect.arrayContaining([expect.objectContaining({ type: "home", slug: "/" })]));
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
