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
import type { SqlExecutor } from "../../commerce/repository.js";
import { SqlCustomDataRepository } from "../../custom-data/sql-repository.js";
import { StorefrontBindingValueService } from "../../dynamic-sources/binding-values.js";
import { createEditorBindingValuesRouter, createPublicBindingValuesRouter } from "../../dynamic-sources/binding-values-routes.js";
import { DynamicValueResolver } from "../../dynamic-sources/resolver.js";
import { createPublicMetaobjectRouter, PublicMetaobjectService } from "../../custom-data/public-metaobjects.js";
import { createMerchantAccessRouter, createPublicAccessRouter } from "../../storefront/access/routes.js";
import { StorefrontAccessService } from "../../storefront/access/service.js";
import { createThemeLibraryRouter } from "../../storefront/theme-library/routes.js";
import { ThemeLibraryService } from "../../storefront/theme-library/service.js";
import { createPublicThemeVersionRouter, createThemePackageRouter } from "../../storefront/theme-packages/routes.js";
import { ThemePackageService } from "../../storefront/theme-packages/service.js";

const accessServices = new WeakMap<AppContext, StorefrontAccessService | null>();

/** Password protection for storefronts; needs the database, so it is off in the local JSON mode. */
function accessService(context: AppContext): StorefrontAccessService | undefined {
  if (!accessServices.has(context)) {
    const database = context.routeDependencies.commerceDatabase;
    accessServices.set(context, database ? new StorefrontAccessService({ query: (text: string, values?: unknown[]) => database.transaction((transaction) => transaction.query(text, values)) } as never) : null);
  }
  return accessServices.get(context) ?? undefined;
}

const libraryServices = new WeakMap<AppContext, ThemeLibraryService | null>();

/** The theme library (saved looks); needs the database, so it is off in the local JSON mode. */
function libraryService(context: AppContext): ThemeLibraryService | undefined {
  if (!libraryServices.has(context)) {
    const database = context.routeDependencies.commerceDatabase;
    libraryServices.set(context, database ? new ThemeLibraryService({ query: (text: string, values?: unknown[]) => database.transaction((transaction) => transaction.query(text, values)) } as never) : null);
  }
  return libraryServices.get(context) ?? undefined;
}

const packageServices = new WeakMap<AppContext, ThemePackageService | null>();

/** Uploaded theme packages; need the database and media storage, so they are off in the local JSON mode. */
function packageService(context: AppContext): ThemePackageService | undefined {
  if (!packageServices.has(context)) {
    const database = context.routeDependencies.commerceDatabase;
    const storage = context.routeDependencies.mediaStorage;
    packageServices.set(context, database && storage ? new ThemePackageService({ query: (text: string, values?: unknown[]) => database.transaction((transaction) => transaction.query(text, values)) } as never, storage) : null);
  }
  return packageServices.get(context) ?? undefined;
}

const bindingValueServices = new WeakMap<AppContext, StorefrontBindingValueService | null>();

/**
 * Custom-field values for storefront sections. Built from the database handle the app
 * resolved at startup (`routeDependencies.commerceDatabase`), so it is off in the local
 * JSON mode, which has no database.
 */
export function bindingValueService(context: AppContext): StorefrontBindingValueService | undefined {
  if (!bindingValueServices.has(context)) {
    const { commerceDatabase: database, contentService: content } = context.routeDependencies;
    const catalog = context.catalogService;
    // One query per statement; the lookups are independent reads.
    const sql: SqlExecutor | undefined = database
      ? { query: (text, values) => database.transaction((transaction) => transaction.query(text, values)) } as SqlExecutor
      : undefined;
    const repository = sql ? new SqlCustomDataRepository(sql) : undefined;
    bindingValueServices.set(context, sql && repository && catalog && content
      ? new StorefrontBindingValueService(new DynamicValueResolver(repository, repository), {
        product: (storeId, id) => catalog.getProduct(storeId, id),
        collection: (storeId, id) => catalog.getCollection(storeId, id),
        page: (storeId, id) => content.getPage(storeId, id),
        blog: (storeId, id) => content.getBlog(storeId, id),
        article: (storeId, id) => content.getArticle(storeId, id),
        storeName: async (storeId) => (await sql.query<{ name: string }>(`SELECT "name" FROM "Store" WHERE "id" = $1`, [storeId])).rows[0]?.name ?? null,
        media: async (storeId, id) => {
          const row = (await sql.query<{ altText: string | null }>(`SELECT "altText" FROM "Media" WHERE "storeId" = $1 AND "id" = $2`, [storeId, id])).rows[0];
          return row ? { url: `/api/public/media/${storeId}/${id}`, ...(row.altText ? { alt: row.altText } : {}) } : null;
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
  const access = accessService(context);
  if (access) app.use("/api/public/stores/:storeId/storefront/access", createPublicAccessRouter(access));
  const themePackages = packageService(context);
  if (themePackages) app.use("/api/public", createPublicThemeVersionRouter(themePackages));
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

  const access = accessService(context);
  if (access) app.use("/api/stores/:storeId/storefront", createMerchantAccessRouter(access, authProvider));
  const library = libraryService(context);
  if (library) app.use("/api/stores/:storeId/storefront", createThemeLibraryRouter(library, authProvider));
  const packages = packageService(context);
  if (packages) app.use("/api/stores/:storeId", createThemePackageRouter(packages, authProvider));
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
