import type { RequestHandler } from "express";
import { ApiError } from "../http/errors.js";
import { isWrite, tooManyChanges, writeLimiter } from "../http/write-limits.js";
import { createStoreRequestContext, type StoreRequestContext } from "../tenants/store-context.js";
import type { AuthProvider, MerchantPrincipal, StorePermission } from "./types.js";

declare global {
  namespace Express {
    interface Request {
      merchant?: MerchantPrincipal;
      storeContext?: StoreRequestContext;
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

export function requireStorePermission(permission: StorePermission): RequestHandler {
  return (request, response, next) => {
    const merchant = request.merchant;
    if (!merchant) {
      next(new ApiError(403, "STORE_FORBIDDEN", "The merchant cannot access this store"));
      return;
    }

    try {
      request.storeContext = createStoreRequestContext(
        merchant,
        String(request.params.storeId),
        permission,
      );
      // Changes are rate limited per person and per shop, only once access is confirmed (step 4 of the billing plan).
      if (isWrite(request.method)) {
        const wait = writeLimiter.take(merchant.userId, request.storeContext.storeId);
        if (wait !== null) {
          response.setHeader("Retry-After", String(wait));
          next(tooManyChanges(wait));
          return;
        }
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
