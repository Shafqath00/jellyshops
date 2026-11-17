import { describe, expect, it } from "vitest";
import { checkoutInputSchema } from "./checkout-cart.js";

const base = { storeId: "s", cartKey: "cart", currency: "gbp", items: [{ variantId: "v", quantity: 1 }] };

describe("checkout buyer details", () => {
  it("needs a real email and keeps the other fields the order uses", () => {
    const parsed = checkoutInputSchema.parse({ ...base, customerSnapshot: { name: "Riya", email: "riya@example.com", note: "Gift", address: { country: "GB" } } });
    expect(parsed.customerSnapshot).toMatchObject({ email: "riya@example.com", note: "Gift", address: { country: "GB" } });
    expect(checkoutInputSchema.safeParse({ ...base, customerSnapshot: { name: "Riya" } }).success).toBe(false);
    expect(checkoutInputSchema.safeParse({ ...base, customerSnapshot: { email: "not-an-email" } }).success).toBe(false);
  });

  it("refuses oversized details", () => {
    expect(checkoutInputSchema.safeParse({ ...base, customerSnapshot: { email: "a@example.com", name: "x".repeat(121) } }).success).toBe(false);
    expect(checkoutInputSchema.safeParse({ ...base, customerSnapshot: { email: "a@example.com", note: "x".repeat(9000) } }).success).toBe(false);
    expect(checkoutInputSchema.safeParse({ ...base, customerSnapshot: { email: "a@example.com" }, deliverySnapshot: { line1: "x".repeat(9000) } }).success).toBe(false);
  });
});
