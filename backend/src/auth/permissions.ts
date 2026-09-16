import type { StoreRole } from "../tenants/types.js";
import type { StorePermission } from "./types.js";

export const ROLE_PERMISSIONS: Record<StoreRole, ReadonlySet<StorePermission>> = {
  OWNER: new Set<StorePermission>([
    "storefront:view", "storefront:edit", "storefront:publish",
    "content:view", "content:edit",
    "catalog:view", "catalog:edit",
    "navigation:edit", "custom_data:edit",
    "media:upload", "media:delete",
    "developer:view", "developer:edit", "developer:build", "developer:publish",
    "team:manage", "settings:manage",
    "payments:view", "payments:manage", "orders:refund",
  ]),
  ADMIN: new Set<StorePermission>([
    "storefront:view", "storefront:edit", "storefront:publish",
    "content:view", "content:edit",
    "catalog:view", "catalog:edit",
    "navigation:edit", "custom_data:edit",
    "media:upload", "media:delete",
    "settings:manage",
    "payments:view", "payments:manage", "orders:refund",
  ]),
  DESIGNER: new Set<StorePermission>([
    "storefront:view", "storefront:edit",
    "content:view", "catalog:view",
    "navigation:edit",
    "media:upload", "media:delete",
  ]),
  DEVELOPER: new Set<StorePermission>([
    "storefront:view", "storefront:edit",
    "content:view", "catalog:view",
    "media:upload", "media:delete",
    "developer:view", "developer:edit", "developer:build",
  ]),
  ORDER_MANAGER: new Set<StorePermission>([
    "storefront:view", "catalog:view",
    "payments:view",
  ]),
  STAFF: new Set<StorePermission>([
    "storefront:view", "content:view", "catalog:view",
  ]),
};

export function roleHasPermission(role: StoreRole, permission: StorePermission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}

export function hasStorePermission(
  principal: { storeIds: string[]; storeRoles: Record<string, StoreRole> },
  storeId: string,
  permission: StorePermission,
): boolean {
  const role = principal.storeRoles[storeId];
  return principal.storeIds.includes(storeId)
    && role !== undefined
    && roleHasPermission(role, permission);
}
