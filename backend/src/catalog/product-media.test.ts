import { describe, expect, it } from "vitest";
import { CatalogService } from "./service.js";

describe("product gallery input", () => {
  it("rejects ambiguous legacy and gallery image writes", async () => {
    const writer = { createProduct: async () => { throw new Error("writer called"); } };
    const service = new CatalogService({} as never, writer as never);
    await expect(service.createProduct("store-a", { title: "Cake", handle: "cake", imageUrl: "https://example.com/a.jpg", media: [] } as never)).rejects.toMatchObject({ code: "MEDIA_INPUT_INVALID" });
  });
});
