import type { StoreRole } from "../tenants/types.js";

export interface MerchantPrincipal {
  merchantId: string;
  storeIds: string[];
  storeRoles: Record<string, StoreRole>;
}

export type StorePermission = "storefront:read" | "storefront:write" | "media:read" | "media:write";

export interface AuthProvider {
  verify(token: string): Promise<MerchantPrincipal>;
}
