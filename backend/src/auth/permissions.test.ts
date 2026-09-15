import { describe, expect, it } from "vitest";
import { roleHasPermission } from "./permissions.js";

describe("store capability matrix", () => {
  it("lets owners use every Phase 1 capability", () => {
    expect(roleHasPermission("OWNER", "storefront:publish")).toBe(true);
    expect(roleHasPermission("OWNER", "developer:publish")).toBe(true);
    expect(roleHasPermission("OWNER", "team:manage")).toBe(true);
  });

  it("lets admins publish storefront design without granting developer-code powers", () => {
    expect(roleHasPermission("ADMIN", "storefront:edit")).toBe(true);
    expect(roleHasPermission("ADMIN", "storefront:publish")).toBe(true);
    expect(roleHasPermission("ADMIN", "developer:edit")).toBe(false);
    expect(roleHasPermission("ADMIN", "developer:publish")).toBe(false);
  });

  it("lets designers edit storefront presentation but not publish or edit source code", () => {
    expect(roleHasPermission("DESIGNER", "storefront:edit")).toBe(true);
    expect(roleHasPermission("DESIGNER", "media:upload")).toBe(true);
    expect(roleHasPermission("DESIGNER", "storefront:publish")).toBe(false);
    expect(roleHasPermission("DESIGNER", "developer:edit")).toBe(false);
  });

  it("lets developers build draft artifacts but not publish them", () => {
    expect(roleHasPermission("DEVELOPER", "storefront:view")).toBe(true);
    expect(roleHasPermission("DEVELOPER", "developer:edit")).toBe(true);
    expect(roleHasPermission("DEVELOPER", "developer:build")).toBe(true);
    expect(roleHasPermission("DEVELOPER", "developer:publish")).toBe(false);
    expect(roleHasPermission("DEVELOPER", "storefront:publish")).toBe(false);
  });

  it("keeps staff and order-manager access least-privileged", () => {
    expect(roleHasPermission("STAFF", "content:view")).toBe(true);
    expect(roleHasPermission("STAFF", "storefront:edit")).toBe(false);
    expect(roleHasPermission("ORDER_MANAGER", "catalog:view")).toBe(true);
    expect(roleHasPermission("ORDER_MANAGER", "storefront:edit")).toBe(false);
  });
});
