import { expect, it } from "vitest";
import { getV4StarterPack } from "./v4-starter-packs";
import { validateV4StarterPack } from "./v4-starter-packs-validation";

it("provides a valid Signature starter with complete protected page templates and no fake endorsements", () => {
  const pack = getV4StarterPack("jelly-signature");
  expect(validateV4StarterPack(pack)).toEqual([]);
  expect(pack.templates.map((item) => item.type)).toEqual(expect.arrayContaining([
    "home", "product", "collection", "cart", "search", "page", "not-found",
    "checkout", "wishlist", "customer-login", "customer-register", "customer-recovery",
    "customer-account", "customer-orders", "customer-order", "customer-addresses", "order-success",
  ]));
  expect(pack.templates.find((item) => item.type === "home")?.layout.sections.length).toBeGreaterThan(7);
  expect(JSON.stringify(pack)).not.toMatch(/five.star|trusted by|verified review|\bMaya\b/i);
});
