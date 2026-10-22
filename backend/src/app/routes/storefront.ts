import type { Express } from "express";
import { requireMerchant, requireStorePermission } from "../../auth/middleware.js";
import { createStorefrontCompilerRouter } from "../../storefront/compiler/routes.js";
import { createPublicStorefrontContextRouter } from "../../storefront/context/routes.js";
import { createStorefrontPublicationRouter } from "../../storefront/publication/routes.js";
import { createStorefrontRouter } from "../../storefront/routes.js";
import { createStorefrontStarterRouter } from "../../storefront/starter/routes.js";
import { createStorefrontWorkspaceRouter } from "../../storefront/workspace/routes.js";
import { defaultStorefrontWorkspaceApi } from "../default-storefront-workspace.js";
import type { AppContext } from "../types.js";

export function mountPublicStorefrontContextRoutes(app: Express, context: AppContext): void {
  const { publicStorefrontContextService } = context;
  if (publicStorefrontContextService) {
    app.use(
      "/api/public/stores/:storeId/storefront/context",
      createPublicStorefrontContextRouter(publicStorefrontContextService),
    );
  }
}

export function mountStorefrontRoutes(app: Express, context: AppContext): void {
  const { routeDependencies: deps, authProvider, storefrontService, publicStorefrontApi, storefrontStarterApi } = context;

  // Public + legacy explicit routes first.
  //
  // This router no longer has router-wide auth, so routes it doesn't
  // recognize safely fall through to the routers below.
  app.use(
    "/api/stores/:storeId/storefront",
    createStorefrontRouter(
      storefrontService,
      publicStorefrontApi,
      authProvider,
    ),
  );

  if (storefrontStarterApi) {
    app.use(
      "/api/stores/:storeId/storefront/starters",
      createStorefrontStarterRouter(storefrontStarterApi, authProvider),
    );
  }

  app.use(
    "/api/stores/:storeId/storefront",
    createStorefrontWorkspaceRouter(
      deps.storefrontWorkspaceApi ??
      defaultStorefrontWorkspaceApi,
      authProvider,
    ),
  );

  if (deps.storefrontCompilerApi) {
    app.use(
      "/api/stores/:storeId/storefront",
      createStorefrontCompilerRouter(
        deps.storefrontCompilerApi,
        authProvider,
      ),
    );
  } else {
    app.post(
      "/api/stores/:storeId/storefront/validate",
      requireMerchant(authProvider),
      requireStorePermission("storefront:view"),
      (_request, response) => {
        response.status(503).json({
          error: {
            code: "STOREFRONT_COMPILER_NOT_CONFIGURED",
            message:
              "Storefront compiler is not configured.",
          },
        });
      },
    );

    app.post(
      "/api/stores/:storeId/storefront/preview/compile",
      requireMerchant(authProvider),
      requireStorePermission("storefront:view"),
      (_request, response) => {
        response.status(503).json({
          error: {
            code: "STOREFRONT_COMPILER_NOT_CONFIGURED",
            message:
              "Storefront compiler is not configured.",
          },
        });
      },
    );
  }

  if (deps.storefrontPublicationApi) {
    app.use(
      "/api/stores/:storeId/storefront",
      createStorefrontPublicationRouter(
        deps.storefrontPublicationApi,
        authProvider,
      ),
    );
  } else {
    app.post(
      "/api/stores/:storeId/storefront/publish",
      requireMerchant(authProvider),
      requireStorePermission("storefront:publish"),
      (_request, response) => {
        response.status(503).json({
          error: {
            code:
              "STOREFRONT_PUBLICATION_NOT_CONFIGURED",
            message:
              "Storefront publication service is not configured.",
          },
        });
      },
    );
  }
}
