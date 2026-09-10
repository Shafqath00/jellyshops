import type { RequestHandler } from "express";
import { ApiError } from "../http/errors.js";
import type { AuthProvider, MerchantPrincipal, StorePermission } from "./types.js";

declare global {
  namespace Express {
    interface Request {
      merchant?: MerchantPrincipal;
    }
  }
}

export function requireMerchant(provider: AuthProvider): RequestHandler {
  return async (request, _response, next) => {
    try {
      const authorization = request.header("authorization");
      const match = authorization?.match(/^Bearer\s+(.+)$/i);
      if (!match) {
        throw new ApiError(401, "AUTH_INVALID", "Merchant authentication is required");
      }
      request.merchant = await provider.verify(match[1]);
      next();
    } catch (error) {
      next(error);
    }
  };
}

const writeRoles = new Set(["OWNER", "ADMIN", "DESIGNER"]);
const readRoles = new Set(["OWNER", "ADMIN", "DESIGNER", "ORDER_MANAGER", "STAFF"]);

export function requireStoreAccess(permission?: StorePermission): RequestHandler {
  return (request, _response, next) => {
    const storeId = String(request.params.storeId);
    const merchant = request.merchant;
    const role = merchant?.storeRoles[storeId];
    const allowedRoles = permission?.endsWith(":write") ? writeRoles : readRoles;
    const allowed = merchant?.storeIds.includes(storeId)
      && (permission === undefined || (role !== undefined && allowedRoles.has(role)));
    if (!allowed) {
      next(new ApiError(403, "STORE_FORBIDDEN", "The merchant cannot access this store"));
      return;
    }
    next();
  };
}
