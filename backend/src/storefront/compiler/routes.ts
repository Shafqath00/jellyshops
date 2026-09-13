import { Router, type Request } from "express";
import { z } from "zod";
import { requireMerchant, requireStorePermission } from "../../auth/middleware.js";
import type { AuthProvider } from "../../auth/types.js";

export interface StorefrontCompilerApi {
  compile(storeId: string, expectedGeneration: number): Promise<{
    ok: boolean;
    diagnostics: unknown[];
    dependencies: unknown;
    snapshot?: unknown;
  }>;
}

const compileRequestSchema = z.object({
  expectedGeneration: z.number().int().nonnegative().max(2_147_483_647),
}).strict();

function storeId(request: Request): string {
  return request.storeContext!.storeId;
}

export function createStorefrontCompilerRouter(api: StorefrontCompilerApi, authProvider: AuthProvider): Router {
  const router = Router({ mergeParams: true });
  router.use(requireMerchant(authProvider));

  router.post("/validate", requireStorePermission("storefront:view"), async (request, response, next) => {
    try {
      const { expectedGeneration } = compileRequestSchema.parse(request.body);
      const result = await api.compile(storeId(request), expectedGeneration);
      response.status(result.ok ? 200 : 422).json({
        ok: result.ok,
        diagnostics: result.diagnostics,
        dependencies: result.dependencies,
      });
    } catch (error) { next(error); }
  });

  router.post("/preview/compile", requireStorePermission("storefront:view"), async (request, response, next) => {
    try {
      const { expectedGeneration } = compileRequestSchema.parse(request.body);
      const result = await api.compile(storeId(request), expectedGeneration);
      response.status(result.ok ? 200 : 422).json({
        ok: result.ok,
        diagnostics: result.diagnostics,
        dependencies: result.dependencies,
        ...(result.ok && result.snapshot ? { snapshot: result.snapshot } : {}),
      });
    } catch (error) { next(error); }
  });

  return router;
}
