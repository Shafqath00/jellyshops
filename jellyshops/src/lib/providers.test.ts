import { mockAuth, mockAssets } from "./providers";

describe("mock providers", () => {
  it("returns the seeded merchant session", async () => {
    await expect(mockAuth.getSession()).resolves.toMatchObject({
      user: { email: "maya@jelly.shop" },
      businessId: "business-jelly"
    });
  });

  it("provides an image fallback when a URL is missing", () => {
    expect(mockAssets.resolve()).toContain("images.unsplash.com");
  });
});
