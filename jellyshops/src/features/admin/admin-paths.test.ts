import { afterEach, describe, expect, it, vi } from "vitest";
import { adminPagePath, isShopAdminHref, shopAdminBase, shopFromAdminPath, toShopAdmin } from "./admin-paths";

afterEach(() => vi.unstubAllEnvs());

describe("toShopAdmin", () => {
  it("puts the shop in old-style admin links (today's addresses)", () => {
    expect(shopAdminBase("myshop")).toBe("/admin/s/myshop");
    expect(toShopAdmin("myshop", "/admin")).toBe("/admin/s/myshop");
    expect(toShopAdmin("myshop", "/admin/orders/42")).toBe("/admin/s/myshop/orders/42");
    expect(toShopAdmin("myshop", "/admin/orders?tab=open")).toBe("/admin/s/myshop/orders?tab=open");
    expect(toShopAdmin("myshop", "/admin?welcome=1")).toBe("/admin/s/myshop?welcome=1");
  });

  it("uses /s/<shop> on the admin host", () => {
    vi.stubEnv("NEXT_PUBLIC_STORE_LINKS", "subdomain");
    expect(toShopAdmin("myshop", "/admin/products")).toBe("/s/myshop/products");
    expect(toShopAdmin("myshop", "/admin")).toBe("/s/myshop");
  });

  it("leaves links that aren't one shop's pages alone", () => {
    for (const href of ["/admin/stores/new", "/admin/design-kit", "/admin/s/other/orders", "/login", "/administrator", "https://example.com/admin"]) {
      expect(isShopAdminHref(href)).toBe(false);
      expect(toShopAdmin("myshop", href)).toBe(href);
    }
  });
});

describe("adminPagePath", () => {
  it("gives the old-style path for every form of a shop's admin address", () => {
    expect(adminPagePath("/admin/s/myshop/orders/42")).toBe("/admin/orders/42");
    expect(adminPagePath("/s/myshop/orders/42")).toBe("/admin/orders/42");
    expect(adminPagePath("/admin/s/myshop")).toBe("/admin");
    expect(adminPagePath("/admin/stores/new")).toBe("/admin/stores/new");
  });

  it("reads the shop from the address", () => {
    expect(shopFromAdminPath("/admin/s/my-shop/orders")).toBe("my-shop");
    expect(shopFromAdminPath("/s/my-shop")).toBe("my-shop");
    expect(shopFromAdminPath("/admin/orders")).toBeNull();
  });
});

describe("adminReturnPath", () => {
  it("turns the admin host's short addresses into ones sign-in will return to", async () => {
    const { adminReturnPath } = await import("@/features/auth/components/admin-auth-gate");
    expect(adminReturnPath("/s/myshop/orders")).toBe("/s/myshop/orders");
    expect(adminReturnPath("/admin/orders")).toBe("/admin/orders");
    expect(adminReturnPath("/orders")).toBe("/admin/orders");
    expect(adminReturnPath("/")).toBe("/admin");
  });
});
