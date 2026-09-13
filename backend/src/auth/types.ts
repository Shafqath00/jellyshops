import type { StoreRole } from "../tenants/types.js";

export interface MerchantPrincipal {
  userId: number;
  storeIds: string[];
  storeRoles: Record<string, StoreRole>;
}

export type StorePermission =
  | "storefront:view"
  | "storefront:edit"
  | "storefront:publish"
  | "content:view"
  | "content:edit"
  | "catalog:view"
  | "catalog:edit"
  | "navigation:edit"
  | "custom_data:edit"
  | "media:upload"
  | "media:delete"
  | "developer:view"
  | "developer:edit"
  | "developer:build"
  | "developer:publish"
  | "team:manage"
  | "settings:manage";

export interface AuthProvider {
  verify(token: string): Promise<MerchantPrincipal>;
}
