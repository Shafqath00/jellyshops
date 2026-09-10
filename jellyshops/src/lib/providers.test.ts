import { mockAuth, mockAssets, mockPayments } from "./providers";

describe("mock providers", () => {
  it("returns the seeded merchant session", async () => {
    await expect(mockAuth.getSession()).resolves.toMatchObject({
      user: { email: "maya@jelly.shop" },
      businessId: "business-jelly"
    });
  });

  it("confirms a deterministic paid payment", async () => {
    await expect(mockPayments.confirm({ amount: 64900, currency: "INR" })).resolves.toEqual({
      id: "mock_payment_64900_INR",
      status: "PAID"
    });
  });

  it("provides an image fallback when a URL is missing", () => {
    expect(mockAssets.resolve()).toContain("images.unsplash.com");
  });
});
