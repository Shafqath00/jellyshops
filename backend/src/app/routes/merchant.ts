import type { Express } from "express";
import { createAdminRouter } from "../../admin/routes.js";
import { requireMerchant, requireStorePermission } from "../../auth/middleware.js";
import { createPublicStoreBySlugRouter, createPublicStoreRouter } from "../../catalog/public-store.js";
import { createCatalogAdminRouter, createCatalogRouter, createPublicCatalogRouter } from "../../catalog/routes.js";
import { PublicOrderRateLimiter } from "../../commerce/rate-limit.js";
import { createContentRouter } from "../../content/routes.js";
import { createCustomDataRouter } from "../../custom-data/routes.js";
import { createCustomerRouter, createEngagementRouter, createMerchantEngagementRouter } from "../../customers/routes.js";
import { createMerchantRouter } from "../../tenants/routes.js";
import { createTaxonomyRouter } from "../../taxonomy/routes.js";
import { SqlTaxonomyRepository } from "../../taxonomy/sql-repository.js";
import { TaxonomyService } from "../../taxonomy/service.js";
import { createStoreSettingsRouter, StoreSettingsRepository } from "../../tenants/settings.js";
import { supabasePool } from "../database.js";
import type { AppContext } from "../types.js";

export function mountStoreSettingsRoutes(app: Express, context: AppContext): void {
  const { authProvider } = context;
  const { commerceDatabase } = context.routeDependencies;
  if (commerceDatabase) {
    app.use("/api/stores/:storeId/settings", createStoreSettingsRouter(authProvider, new StoreSettingsRepository(commerceDatabase)));
  }
}

export function mountCustomerRoutes(app: Express, context: AppContext): void {
  const { customerService, commerceRepository, verifyCustomer, authProvider } = context;
  if (customerService && commerceRepository) {
    const limiter = new PublicOrderRateLimiter(commerceRepository, { namespace: "store-engagement", limit: 10, code: "ENGAGEMENT_RATE_LIMITED" });
    if (verifyCustomer) app.use("/api/public/stores/:storeId/customer", createCustomerRouter(customerService, verifyCustomer));
    app.use("/api/public/stores/:storeId/engagement", createEngagementRouter(customerService, (storeId, ip) => limiter.assertAllowed(storeId, ip)));
    app.use("/api/stores/:storeId/engagement", createMerchantEngagementRouter(customerService, authProvider));
  }
}

export function mountTenantRoutes(app: Express, context: AppContext): void {
  const { routeDependencies: deps, authProvider } = context;

  if (!deps.tenantRepository) {
    return;
  }

  app.use(
    "/api",
    createMerchantRouter(
      authProvider,
      deps.tenantRepository,
    ),
  );
}

export function mountAdminRoutes(app: Express, context: AppContext): void {
  const { adminServices: services, authProvider } = context;

  if (!services) return;
  app.use("/api/stores/:storeId", createAdminRouter(services, authProvider));
}

export function mountCatalogRoutes(app: Express, context: AppContext): void {
  const { authProvider, catalogService } = context;
  const deps = { ...context.routeDependencies, catalogService };

  app.use(
    "/api/demo/catalog",
    createCatalogRouter(),
  );

  if (supabasePool) {
    app.use(
      "/api/public/storefronts/:slug",
      createPublicStoreBySlugRouter(supabasePool),
    );
    app.use(
      "/api/public/stores/:storeId",
      createPublicStoreRouter(supabasePool),
    );
  }

  if (!deps.catalogService) {
    return;
  }

  app.use(
    "/api/stores/:storeId/catalog",
    createCatalogAdminRouter(
      deps.catalogService,
      authProvider,
    ),
  );

  const { commerceDatabase } = context.routeDependencies;
  if (commerceDatabase) {
    app.use("/api/stores/:storeId/taxonomy", createTaxonomyRouter(new TaxonomyService(new SqlTaxonomyRepository(commerceDatabase)), authProvider));
  }

  app.use(
    "/api/public/stores/:storeId/catalog",
    createPublicCatalogRouter(
      deps.catalogService,
    ),
  );
}

export function mountContentRoutes(app: Express, context: AppContext): void {
  const { routeDependencies: deps, authProvider } = context;

  if (deps.contentService) {
    app.use(
      "/api/stores/:storeId/content",
      createContentRouter(
        deps.contentService,
        authProvider,
      ),
    );
  }

  if (
    deps.customDataService &&
    deps.metaobjectService &&
    deps.dynamicSourceRegistry
  ) {
    app.use(
      "/api/stores/:storeId/custom-data",
      createCustomDataRouter(
        {
          customData:
            deps.customDataService,
          metaobjects:
            deps.metaobjectService,
          registry:
            deps.dynamicSourceRegistry,
        },
        authProvider,
      ),
    );
  }

  app.get(
    "/api/stores/:storeId/custom-data/dynamic-sources",
    requireMerchant(authProvider),
    requireStorePermission(
      "storefront:view",
    ),
    (_request, response) => {
      response.json([
        {
          id: "resource:store:name",
          label: "Store name",
          valueType: "string",
          requiredContext: "any",
          binding: {
            kind: "resource_field",
            resource: "store",
            field: "name",
          },
        },
      ]);
    },
  );
}
