import { Router, type RequestHandler } from "express";
import { z } from "zod";
import { requireMerchant, requireStorePermission } from "../auth/middleware.js";
import type { AuthProvider, StorePermission } from "../auth/types.js";
import { ApiError } from "../http/errors.js";
import { isDeveloperToken, type DeveloperTokenService } from "./service.js";

const createSchema = z.object({
  name: z.string(),
  expiresInDays: z.union([z.literal(30), z.literal(90), z.literal(365), z.null()]).optional(),
}).strict();

/** `/api/stores/:storeId/developer-tokens`: owners and developers create, list and revoke tokens. */
export function createDeveloperTokenRouter(service: Pick<DeveloperTokenService, "list" | "create" | "revoke">, authProvider: AuthProvider): Router {
  const router = Router({ mergeParams: true });
  router.get("/developer-tokens", requireMerchant(authProvider), requireStorePermission("developer:view"), async (request, response, next) => {
    try { response.json({ tokens: await service.list(request.storeContext!.storeId) }); } catch (error) { next(error); }
  });
  router.post("/developer-tokens", requireMerchant(authProvider), requireStorePermission("developer:edit"), async (request, response, next) => {
    try {
      const { token, summary } = await service.create(request.storeContext!.storeId, request.storeContext!.userId, createSchema.parse(request.body ?? {}));
      // The only time the token is ever shown.
      response.setHeader("cache-control", "no-store");
      response.status(201).json({ token, summary });
    } catch (error) { next(error); }
  });
  router.post("/developer-tokens/:tokenId/revoke", requireMerchant(authProvider), requireStorePermission("developer:edit"), async (request, response, next) => {
    try { await service.revoke(request.storeContext!.storeId, String(request.params.tokenId)); response.status(204).end(); } catch (error) { next(error); }
  });
  return router;
}

/**
 * For routes a developer token may use (theme packages): a `jdt_` bearer token is checked against
 * the store in the address and the scope; any other bearer token goes through the normal merchant
 * sign-in and permission check.
 */
export function merchantOrDeveloperToken(authProvider: AuthProvider, tokens: Pick<DeveloperTokenService, "verify"> | undefined, permission: StorePermission, scope = "themes"): RequestHandler {
  const merchant = requireMerchant(authProvider);
  const allowed = requireStorePermission(permission);
  return (request, response, next) => {
    const bearer = request.header("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!bearer || !isDeveloperToken(bearer)) {
      merchant(request, response, (error?: unknown) => (error ? next(error) : allowed(request, response, next)));
      return;
    }
    if (!tokens) { next(new ApiError(401, "AUTH_INVALID", "Developer tokens are not available here.")); return; }
    tokens.verify(bearer).then((verified) => {
      const storeId = String(request.params.storeId);
      if (!verified) throw new ApiError(401, "AUTH_INVALID", "This developer token is not valid. It may have been revoked or expired, or its creator no longer manages this store.");
      if (verified.storeId !== storeId || !verified.scopes.includes(scope)) throw new ApiError(403, "STORE_FORBIDDEN", "This developer token belongs to another store or cannot do this.");
      request.storeContext = { storeId, userId: `developer-token:${verified.tokenId}`, role: "DEVELOPER" };
      next();
    }).catch(next);
  };
}
