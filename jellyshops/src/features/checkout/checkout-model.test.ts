import { describe, expect, it } from "vitest";
import { checkoutProblem } from "./checkout-errors";
import { addressWording, EMPTY_DETAILS, safeReturnUrl, validateDetails } from "./checkout-model";

describe("checkout rules", () => {
  it("asks for an address only when something is delivered", () => {
    const details = { ...EMPTY_DETAILS, email: "a@example.com", name: "A" };
    expect(validateDetails(details, false, "GB")).toEqual({});
    expect(Object.keys(validateDetails(details, true, "GB"))).toEqual(["phone", "line1", "city", "postalCode"]);
    expect(Object.keys(validateDetails(details, true, "US"))).toContain("region");
  });

  it("uses each country's words for the address", () => {
    expect(addressWording("GB")).toMatchObject({ postalCode: "Postcode", regionRequired: false });
    expect(addressWording("US")).toMatchObject({ postalCode: "ZIP code", region: "State" });
    expect(addressWording("IN").postalCode).toBe("PIN code");
  });

  it("only returns shoppers to this site, over https (http on localhost)", () => {
    expect(safeReturnUrl("/shop/order/t?paid=1", "https://shop.example")).toBe("https://shop.example/shop/order/t?paid=1");
    expect(safeReturnUrl("/shop/order/t", "http://localhost:3000")).toBe("http://localhost:3000/shop/order/t");
    expect(safeReturnUrl("/shop/order/t", "http://shop.example")).toBeNull();
    expect(safeReturnUrl("https://evil.example/x", "https://shop.example")).toBeNull();
    expect(safeReturnUrl("//evil.example/x", "https://shop.example")).toBeNull();
  });

  it("never shows codes to shoppers", () => {
    expect(checkoutProblem(Object.assign(new Error("OUT_OF_STOCK"), { status: 409, code: "OUT_OF_STOCK" })).message).toMatch(/sold out/);
    expect(checkoutProblem(Object.assign(new Error("SOME_NEW_CODE"), { status: 422 })).message).not.toMatch(/_/);
    expect(checkoutProblem(new TypeError("Failed to fetch"))).toMatchObject({ retryable: true });
    expect(checkoutProblem(Object.assign(new Error("x"), { status: 503 })).message).toMatch(/Nothing has been charged/);
  });
});
