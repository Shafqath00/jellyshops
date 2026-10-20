import { ApiError } from "../http/errors.js";
import { hasStorePermission } from "../auth/permissions.js";
import type { MerchantPrincipal, StorePermission } from "../auth/types.js";
import type { StoreRole } from "./types.js";

export interface StoreRequestContext {
  storeId: string;
  userId: string;
  role: StoreRole;
}

export function createStoreRequestContext(
  principal: MerchantPrincipal,
  storeId: string,
  permission: StorePermission,
): StoreRequestContext {
  const role = principal.storeRoles[storeId];
  if (!role) {
    throw new ApiError(404, "STORE_NOT_FOUND", "Store not found");
  }
  if (!hasStorePermission(principal, storeId, permission)) {
    throw new ApiError(403, "STORE_FORBIDDEN", "The merchant cannot access this store");
  }

  return {
    storeId,
    userId: principal.userId,
    role,
  };
}
