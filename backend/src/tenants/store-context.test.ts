import { describe, expect, it } from "vitest";
import { ApiError } from "../http/errors.js";
import type { MerchantPrincipal } from "../auth/types.js";
import { createStoreRequestContext } from "./store-context.js";

const principal: MerchantPrincipal = {
  userId: 7,
  storeIds: ["store-a", "store-b"],
  storeRoles: {
    "store-a": "ADMIN",
    "store-b": "STAFF",
  },
};

describe("createStoreRequestContext", () => {
  it("returns only the requested authorized store membership", () => {
    expect(createStoreRequestContext(principal, "store-a", "catalog:edit")).toEqual({
      storeId: "store-a",
      userId: 7,
      role: "ADMIN",
    });
  });

  it("rejects a store that is not in the principal memberships", () => {
    expect(() => createStoreRequestContext(principal, "store-c", "catalog:view"))
      .toThrowError(ApiError);
  });

  it("rejects a membership that lacks the requested capability", () => {
    expect(() => createStoreRequestContext(principal, "store-b", "catalog:edit"))
      .toThrowError(ApiError);
  });
});
