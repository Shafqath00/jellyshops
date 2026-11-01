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
import { SqlCustomDataRepository } from "../../custom-data/sql-repository.js";
import { StorefrontBindingValueService } from "../../dynamic-sources/binding-values.js";
import { createEditorBindingValuesRouter, createPublicBindingValuesRouter } from "../../dynamic-sources/binding-values-routes.js";
import { DynamicValueResolver } from "../../dynamic-sources/resolver.js";
import { createPublicMetaobjectRouter, PublicMetaobjectService } from "../../custom-data/public-metaobjects.js";

const bindingValueServices = new WeakMap<AppContext, StorefrontBindingValueService | null>();

/** Custom-field values for storefront sections; needs the SQL database, so it is off in the local JSON mode. */
function bindingValueService(context: AppContext): StorefrontBindingValueService | undefined {
  if (!bindingValueServices.has(context)) {
    const { storefrontSql: sql, contentService: content, mediaRepository: media } = context.routeDependencies;
    const catalog = context.catalogService;
    const repository = sql ? new SqlCustomDataRepository(sql) : undefined;
    bindingValueServices.set(context, sql && repository && catalog && content && media
      ? new StorefrontBindingValueService(new DynamicValueResolver(repository, repository), {
        product: (storeId, id) => catalog.getProduct(storeId, id),
        collection: (storeId, id) => catalog.getCollection(storeId, id),
        page: (storeId, id) => content.getPage(storeId, id),
        blog: (storeId, id) => content.getBlog(storeId, id),
        article: (storeId, id) => content.getArticle(storeId, id),
        storeName: async (storeId) => (await sql.query<{ name: string }>(`SELECT "name" FROM "Store" WHERE "id" = $1`, [storeId])).rows[0]?.name ?? null,
        media: async (storeId, id) => {
          const record = await media.get(storeId, id);
          return record ? { url: record.url, ...(record.altText ? { alt: record.altText } : {}) } : null;
        },
      })
      : null);
  }
  return bindingValueServices.get(context) ?? undefined;
}

export function mountPublicStorefrontContextRoutes(app: Express, context: AppContext): void {
  const { publicStorefrontContextService } = context;
  const bindingValues = bindingValueService(context);
  if (bindingValues) {
    app.use("/api/public/stores/:storeId/storefront/binding-values", createPublicBindingValuesRouter(bindingValues));
  }
  const metaobjects = context.routeDependencies.metaobjectService;
  if (metaobjects) {
    app.use("/api/public/stores/:storeId/storefront/metaobjects", createPublicMetaobjectRouter(new PublicMetaobjectService(metaobjects)));
  }
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

  const bindingValues = bindingValueService(context);
  if (bindingValues) {
    app.use("/api/stores/:storeId/storefront", createEditorBindingValuesRouter(bindingValues, authProvider));
  }

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
