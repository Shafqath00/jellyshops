import { randomUUID } from "node:crypto";

import type {
  GlobalSettings,
  SectionNode,
  StorefrontDocument,
  ThemeId,
} from "@jelly/storefront-schema";
import { createStorefrontTemplate } from "@jelly/storefront-schema";
import cors from "cors";
import express, { type Express } from "express";

import { DevelopmentAuthProvider } from "./auth/development-auth-provider.js";
import {
  requireMerchant,
  requireStorePermission,
} from "./auth/middleware.js";
import type { AuthProvider } from "./auth/types.js";

import {
  createCatalogAdminRouter,
  createCatalogRouter,
  createPublicCatalogRouter,
} from "./catalog/routes.js";
import type { CatalogAdmin } from "./catalog/service.js";
import { createPublicStoreRouter } from "./catalog/public-store.js";
import { CatalogService } from "./catalog/service.js";
import { CatalogPostgresRepository } from "./catalog/postgres-repository.js";

import {
  createMerchantOrderRouter,
} from "./commerce/merchant-order-routes.js";
import type { MerchantOrderService } from "./commerce/merchant-orders.js";
import type { SqlExecutor } from "./commerce/repository.js";
import {
  createCommerceRouter,
  createPublicOrderRouter,
} from "./commerce/routes.js";
import type { CheckoutService } from "./commerce/service.js";
import {
  createSweeperRouter,
} from "./commerce/sweeper-routes.js";
import type { ReservationSweeper } from "./commerce/sweeper.js";

import {
  loadConfig,
  type AppConfig,
} from "./config.js";

import { createContentRouter } from "./content/routes.js";
import type { ContentService } from "./content/service.js";

import {
  createCustomDataRouter,
} from "./custom-data/routes.js";
import type {
  CustomDataService,
  MetaobjectService,
} from "./custom-data/service.js";

import { createSupabasePool } from "./database/client.js";

import type {
  DynamicSourceRegistry,
} from "./dynamic-sources/registry.js";

import {
  errorHandler,
  notFoundHandler,
} from "./http/errors.js";

import {
  LocalJsonMediaRepository,
} from "./media/local-json-media-repository.js";
import {
  LocalMediaStorage,
} from "./media/local-media-storage.js";
import { SupabaseMediaStorage } from "./media/supabase-media-storage.js";
import type {
  MediaRepository,
} from "./media/repository.js";
import {
  createMediaRouter,
  createPublicMediaRouter,
} from "./media/routes.js";
import { MediaService } from "./media/service.js";
import type { MediaStorage } from "./media/storage.js";

import {
  createStripeConnectRouter,
} from "./stripe/accounts/routes.js";
import type {
  StripeAccountService,
} from "./stripe/accounts/service.js";
import type { StripeGateway } from "./stripe/client.js";
import {
  createAccountsV2WebhookRouter,
} from "./stripe/webhooks/accounts-v2-route.js";
import {
  createConnectPaymentsWebhookRouter,
} from "./stripe/webhooks/connect-payments-route.js";

import {
  createStorefrontCompilerRouter,
  type StorefrontCompilerApi,
} from "./storefront/compiler/routes.js";
import {
  createDefaultStorefrontDocument,
  storefrontDocumentValidator,
} from "./storefront/document-validator.js";
import {
  LocalJsonStorefrontRepository,
} from "./storefront/local-json-repository.js";
import {
  createStorefrontPublicationRouter,
  type StorefrontPublicationApi,
} from "./storefront/publication/routes.js";
import type {
  StorefrontRepository,
} from "./storefront/repository.js";
import {
  createStorefrontRouter,
} from "./storefront/routes.js";
import {
  DefaultStorefrontService,
  type DocumentValidator,
} from "./storefront/service.js";
import {
  createStorefrontWorkspaceRouter,
  type StorefrontWorkspaceApi,
} from "./storefront/workspace/routes.js";
import {
  updateSupabaseTemplate,
} from "./storefront/workspace/supabase-template-store.js";

import {
  createMerchantRouter,
} from "./tenants/routes.js";
import type {
  TenantRepository,
} from "./tenants/repository.js";

/* -------------------------------------------------------------------------- */
/* Express types                                                              */
/* -------------------------------------------------------------------------- */

declare global {
  namespace Express {
    interface Request {
      id: string;
    }
  }
}


/* -------------------------------------------------------------------------- */
/* Dependencies                                                               */
/* -------------------------------------------------------------------------- */

export interface AppDependencies {
  config: AppConfig;
  authProvider: AuthProvider;

  // Tenant / catalog / content
  tenantRepository: TenantRepository;
  catalogService: CatalogAdmin;
  contentService: ContentService;
  customDataService: CustomDataService;
  metaobjectService: MetaobjectService;
  dynamicSourceRegistry: DynamicSourceRegistry;

  // Media
  mediaRepository: MediaRepository;
  mediaStorage: MediaStorage;

  // Storefront
  storefrontRepository: StorefrontRepository<unknown>;
  documentValidator: DocumentValidator<unknown>;
  storefrontWorkspaceApi: StorefrontWorkspaceApi;
  storefrontCompilerApi: StorefrontCompilerApi;
  storefrontPublicationApi: StorefrontPublicationApi;
  publicStorefrontApi: PublicStorefrontApi;

  // Stripe / commerce
  stripeAccountService?: StripeAccountService;
  checkoutService?: CheckoutService;
  stripeGateway?: StripeGateway;
  webhookSql?: SqlExecutor;
  reservationSweeper?: ReservationSweeper;
  merchantOrderService?: MerchantOrderService;
}

export interface PublicStorefrontApi {
  load(
    storeId: string,
  ): Promise<{
    id: string;
    document: StorefrontDocument;
  }>;
}


/* -------------------------------------------------------------------------- */
/* Database                                                                   */
/* -------------------------------------------------------------------------- */

const supabasePool =
  process.env.SUPABASE_DATABASE_URL
    ? createSupabasePool()
    : undefined;


/* -------------------------------------------------------------------------- */
/* Default storefront data                                                    */
/* -------------------------------------------------------------------------- */

const defaultHomeTemplate = {
  id: "home",
  storeId: "store-demo",
  revision: 1,
  type: "home" as const,
  handle: "home",
  name: "Home page",

  layout: {
    sections: [
      {
        kind: "inline",
        section: {
          id: "welcome",
          type: "hero",
          enabled: true,
          settings: {},
          blocks: [
            {
              id: "welcome-heading",
              type: "heading",
              enabled: true,
              settings: {
                text: "Welcome",
              },
            },
          ],
        },
      },
    ],
  },

  createdAt: new Date(0),
  updatedAt: new Date(0),
};


/* -------------------------------------------------------------------------- */
/* Storefront helpers                                                         */
/* -------------------------------------------------------------------------- */

function asRecord(
  value: unknown,
): Record<string, unknown> | undefined {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function asThemeId(
  value: unknown,
): ThemeId | undefined {
  const themes: ThemeId[] = [
    "minimal",
    "classic",
    "bold",
    "elegant",
    "playful",
    "fresh-market",
    "artisan-boutique",
  ];

  return themes.includes(value as ThemeId)
    ? (value as ThemeId)
    : undefined;
}

function asSection(
  value: unknown,
): SectionNode | undefined {
  const candidate = asRecord(value);

  if (!candidate) {
    return undefined;
  }

  const valid =
    typeof candidate.id === "string" &&
    typeof candidate.type === "string" &&
    typeof candidate.enabled === "boolean" &&
    Boolean(asRecord(candidate.settings)) &&
    Array.isArray(candidate.blocks);

  if (!valid) {
    return undefined;
  }

  return candidate as unknown as SectionNode;
}


/**
 * Converts an editor-owned home template into
 * the document consumed by the public storefront.
 */
export function publicDocumentFromTemplate(
  storeId: string,
  layout: unknown,
): StorefrontDocument {
  const source = asRecord(layout);
  const sourceTheme = asRecord(source?.theme);

  const selectedTheme =
    asThemeId(sourceTheme?.id) ?? "minimal";

  const fallback =
    createDefaultStorefrontDocument(
      storeId,
      selectedTheme,
    );

  const settings = asRecord(
    sourceTheme?.settings,
  ) as GlobalSettings | undefined;

  const inlineSections =
    Array.isArray(source?.sections)
      ? source.sections.flatMap(
          (placement) => {
            const item =
              asRecord(placement);

            if (item?.kind !== "inline") {
              return [];
            }

            const parsed =
              asSection(item.section);

            return parsed
              ? [parsed]
              : [];
          },
        )
      : [];

  const templateSections =
    inlineSections.length > 0
      ? inlineSections
      : fallback.regions.template;

  return {
    ...fallback,

    theme: {
      presetId: selectedTheme,
      settings:
        settings ??
        fallback.theme.settings,
    },

    regions: {
      ...fallback.regions,
      template: templateSections,
    },

    pages: fallback.pages.map(
      (page) =>
        page.type === "home"
          ? {
              ...page,
              sections:
                templateSections,
            }
          : page,
    ),
  };
}


/* -------------------------------------------------------------------------- */
/* Default public storefront API                                              */
/* -------------------------------------------------------------------------- */

const defaultPublicStorefrontApi: PublicStorefrontApi = {
  async load(storeId) {
    const templateId = storeId === "store-demo" ? "bakes" : "essentials";
    if (!supabasePool) {
      return {
        id: `publication-${storeId}`,
        document: createStorefrontTemplate(templateId, storeId),
      };
    }

    const result =
      await supabasePool.query(
        `
          SELECT
            "id",
            "revision",
            "layout"
          FROM "StorefrontTemplate"
          WHERE "storeId" = $1
            AND lower("type"::text) = 'home'
          ORDER BY "updatedAt" DESC
          LIMIT 1
        `,
        [storeId],
      );

    const template =
      result.rows[0];

    // The legacy `home` template is the generic starter and must not replace
    // the two commerce-ready templates used by the public stores.
    if (!template || template.id === "home") {
      return {
        id: `publication-${storeId}`,
        document: createStorefrontTemplate(templateId, storeId),
      };
    }

    return {
      id:
        `template-${template.id}-r${template.revision}`,

      document:
        publicDocumentFromTemplate(
          storeId,
          template.layout,
        ),
    };
  },
};


/* -------------------------------------------------------------------------- */
/* Default storefront workspace API                                           */
/* -------------------------------------------------------------------------- */

const defaultStorefrontWorkspaceApi: StorefrontWorkspaceApi = {
  async getWorkspace(storeId) {
    if (!supabasePool) {
      return {
        generation: 0,
        updatedAt: new Date(0),
      };
    }

    const result =
      await supabasePool.query(
        `
          SELECT
            "generation",
            "updatedAt"
          FROM "StorefrontWorkspace"
          WHERE "storeId" = $1
        `,
        [storeId],
      );

    return (
      result.rows[0] ?? {
        generation: 0,
        updatedAt: new Date(0),
      }
    );
  },

  async listTemplates(storeId) {
    if (!supabasePool) {
      return [defaultHomeTemplate];
    }

    const result =
      await supabasePool.query(
        `
          SELECT
            "id",
            "storeId",
            "revision",
            lower("type"::text) AS "type",
            "handle",
            "name",
            "layout",
            "createdAt",
            "updatedAt"
          FROM "StorefrontTemplate"
          WHERE "storeId" = $1
          ORDER BY "createdAt"
        `,
        [storeId],
      );

    return result.rows;
  },

  async getTemplate(
    storeId,
    templateId,
  ) {
    if (!supabasePool) {
      return templateId ===
        defaultHomeTemplate.id
        ? defaultHomeTemplate
        : null;
    }

    const result =
      await supabasePool.query(
        `
          SELECT
            "id",
            "storeId",
            "revision",
            lower("type"::text) AS "type",
            "handle",
            "name",
            "layout",
            "createdAt",
            "updatedAt"
          FROM "StorefrontTemplate"
          WHERE "storeId" = $1
            AND "id" = $2
        `,
        [storeId, templateId],
      );

    return result.rows[0] ?? null;
  },

  async createTemplate(
    _storeId,
    input,
  ) {
    return input;
  },

  async updateTemplate(
    storeId,
    templateId,
    revision,
    patch,
  ) {
    if (supabasePool) {
      return updateSupabaseTemplate(
        supabasePool,
        storeId,
        templateId,
        revision,
        patch,
      );
    }

    return {
      template: {
        ...defaultHomeTemplate,
        id: templateId,
        revision: revision + 1,
        ...patch,
        updatedAt: new Date(),
      },
      generation: 1,
    };
  },

  async cloneTemplate(
    _storeId,
    templateId,
    input,
  ) {
    return {
      id: templateId,
      ...input,
    };
  },

  async listGlobalSections(
    storeId,
  ) {
    if (!supabasePool) {
      return [];
    }

    const result =
      await supabasePool.query(
        `
          SELECT
            "id",
            "storeId",
            "revision",
            "name",
            "section",
            "createdAt",
            "updatedAt"
          FROM "GlobalSection"
          WHERE "storeId" = $1
          ORDER BY "createdAt"
        `,
        [storeId],
      );

    return result.rows;
  },

  async getGlobalSection() {
    return null;
  },

  async createGlobalSection(
    _storeId,
    input,
  ) {
    return input;
  },

  async updateGlobalSection(
    _storeId,
    id,
    _revision,
    patch,
  ) {
    return {
      id,
      ...patch,
    };
  },

  async listPresets(storeId) {
    if (!supabasePool) {
      return [];
    }

    const result =
      await supabasePool.query(
        `
          SELECT
            "id",
            "storeId",
            "revision",
            "name",
            "section",
            "createdAt",
            "updatedAt"
          FROM "SectionPreset"
          WHERE "storeId" = $1
          ORDER BY "createdAt"
        `,
        [storeId],
      );

    return result.rows;
  },

  async createPreset(
    _storeId,
    input,
  ) {
    return input;
  },

  async instantiatePreset() {
    return {};
  },

  async listMenus() {
    return [];
  },

  async getMenu() {
    return null;
  },

  async createMenu(
    _storeId,
    input,
  ) {
    return input;
  },

  async updateMenu(
    _storeId,
    id,
    _revision,
    patch,
  ) {
    return {
      id,
      ...patch,
    };
  },

  async getThemeConfiguration() {
    return null;
  },

  async saveThemeConfiguration(
    _storeId,
    _revision,
    input,
  ) {
    return input;
  },

  async getAssignment() {
    return null;
  },

  async assignTemplate(
    _storeId,
    input,
  ) {
    return input;
  },
};


/* -------------------------------------------------------------------------- */
/* Base middleware                                                            */
/* -------------------------------------------------------------------------- */

function configureMiddleware(
  app: Express,
  config: AppConfig,
): void {
  app.disable("x-powered-by");

  app.set(
    "trust proxy",
    config.trustProxy,
  );

  app.use(
    (request, response, next) => {
      request.id = randomUUID();

      response.setHeader(
        "x-request-id",
        request.id,
      );

      next();
    },
  );

  app.use(
    cors({
      origin: config.corsOrigins,
    }),
  );
}


/* -------------------------------------------------------------------------- */
/* Stripe webhooks                                                            */
/* -------------------------------------------------------------------------- */

function mountStripeWebhooks(
  app: Express,
  deps: Partial<AppDependencies>,
): void {
  if (
    deps.stripeGateway &&
    deps.stripeAccountService &&
    deps.webhookSql
  ) {
    app.use(
      "/webhooks/stripe/accounts-v2",
      createAccountsV2WebhookRouter(
        deps.stripeGateway,
        deps.stripeAccountService,
        deps.webhookSql,
      ),
    );
  }

  if (
    deps.stripeGateway &&
    deps.webhookSql
  ) {
    app.use(
      "/webhooks/stripe/connect-payments",
      createConnectPaymentsWebhookRouter(
        deps.stripeGateway,
        deps.webhookSql,
      ),
    );
  }
}


/* -------------------------------------------------------------------------- */
/* Internal routes                                                            */
/* -------------------------------------------------------------------------- */

function mountInternalRoutes(
  app: Express,
  deps: Partial<AppDependencies>,
  config: AppConfig,
): void {
  if (
    deps.reservationSweeper &&
    config.stripe?.schedulerSecret
  ) {
    app.use(
      "/internal/commerce/reservations/sweep",
      createSweeperRouter(
        deps.reservationSweeper,
        config.stripe.schedulerSecret,
      ),
    );
  }

  app.get(
    "/health",
    (_request, response) => {
      response.json({
        ok: true,
      });
    },
  );
}


/* -------------------------------------------------------------------------- */
/* Commerce routes                                                            */
/* -------------------------------------------------------------------------- */

function mountCommerceRoutes(
  app: Express,
  deps: Partial<AppDependencies>,
  authProvider: AuthProvider,
): void {
  if (deps.stripeAccountService) {
    app.use(
      "/api/stores/:storeId/stripe-connect",
      createStripeConnectRouter(
        deps.stripeAccountService,
        authProvider,
      ),
    );
  }

  if (deps.checkoutService) {
    app.use(
      "/api/public/stores/:storeId/checkout",
      createCommerceRouter(
        deps.checkoutService,
      ),
    );

    app.use(
      "/api/public/stores/:storeId/orders",
      createPublicOrderRouter(
        deps.checkoutService,
      ),
    );
  } else {
    // Keep the public checkout contract visible even when the server has not
    // been configured with Stripe/commerce dependencies. Returning an
    // explicit 503 is substantially more useful than Express' generic 404:
    // the route exists, but payment infrastructure is not available.
    app.use(
      "/api/public/stores/:storeId/checkout",
      (_request, response) => {
        response.status(503).json({
          error: {
            code: "CHECKOUT_NOT_CONFIGURED",
            message:
              "Checkout is not configured. Set the server Stripe and database environment variables.",
          },
        });
      },
    );

    app.use(
      "/api/public/stores/:storeId/orders",
      (_request, response) => {
        response.status(503).json({
          error: {
            code: "ORDERS_NOT_CONFIGURED",
            message:
              "Order lookup is not configured. Set the server Stripe and database environment variables.",
          },
        });
      },
    );
  }

  if (deps.merchantOrderService) {
    app.use(
      "/api/stores/:storeId/orders",
      createMerchantOrderRouter(
        deps.merchantOrderService,
        authProvider,
      ),
    );
  }
}


/* -------------------------------------------------------------------------- */
/* Tenant routes                                                              */
/* -------------------------------------------------------------------------- */

function mountTenantRoutes(
  app: Express,
  deps: Partial<AppDependencies>,
  authProvider: AuthProvider,
): void {
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


/* -------------------------------------------------------------------------- */
/* Catalog routes                                                             */
/* -------------------------------------------------------------------------- */

function mountCatalogRoutes(
  app: Express,
  deps: Partial<AppDependencies>,
  authProvider: AuthProvider,
): void {
  app.use(
    "/api/demo/catalog",
    createCatalogRouter(),
  );

  if (supabasePool) {
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

  app.use(
    "/api/public/stores/:storeId/catalog",
    createPublicCatalogRouter(
      deps.catalogService,
    ),
  );
}


/* -------------------------------------------------------------------------- */
/* Content / custom data                                                      */
/* -------------------------------------------------------------------------- */

function mountContentRoutes(
  app: Express,
  deps: Partial<AppDependencies>,
  authProvider: AuthProvider,
): void {
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


/* -------------------------------------------------------------------------- */
/* Storefront                                                                 */
/* -------------------------------------------------------------------------- */

function mountStorefrontRoutes(
  app: Express,
  deps: Partial<AppDependencies>,
  authProvider: AuthProvider,
  storefrontService: DefaultStorefrontService<unknown>,
  publicStorefrontApi: PublicStorefrontApi,
): void {
  app.post(
    "/api/stores/:storeId/storefront/publish",
    requireMerchant(authProvider),
    requireStorePermission(
      "storefront:edit",
    ),
    async (
      request,
      response,
      next,
    ) => {
      try {
        const storeId =
          request.storeContext!.storeId;

        const generation =
          Number(
            request.body
              ?.expectedGeneration ??
              0,
          );

        if (supabasePool) {
          await supabasePool.query(
            `
              UPDATE "StorefrontWorkspace"
              SET
                "generation" =
                  GREATEST(
                    "generation",
                    $1
                  ),
                "updatedAt" = NOW()
              WHERE "storeId" = $2
            `,
            [
              generation,
              storeId,
            ],
          );
        }

        response.json({
          ok: true,

          publication: {
            id:
              `publication-${storeId}-${generation}`,
            storeId,
            sourceGeneration:
              generation,
          },

          diagnostics: [],
        });
      } catch (error) {
        next(error);
      }
    },
  );

  for (const path of [
    "validate",
    "preview/compile",
  ]) {
    app.post(
      `/api/stores/:storeId/storefront/${path}`,
      requireMerchant(
        authProvider,
      ),
      requireStorePermission(
        "storefront:view",
      ),
      (_request, response) => {
        response.json({
          ok: true,
          diagnostics: [],
          dependencies: {},
        });
      },
    );
  }

  app.get(
    "/api/stores/:storeId/storefront/public",
    async (
      request,
      response,
      next,
    ) => {
      try {
        const storeId =
          String(
            request.params.storeId,
          );

        const result =
          await publicStorefrontApi.load(
            storeId,
          );

        response.json(result);
      } catch (error) {
        next(error);
      }
    },
  );

  app.use(
    "/api/stores/:storeId/storefront",
    createStorefrontWorkspaceRouter(
      deps.storefrontWorkspaceApi ??
        defaultStorefrontWorkspaceApi,
      authProvider,
    ),
  );

  if (
    deps.storefrontCompilerApi
  ) {
    app.use(
      "/api/stores/:storeId/storefront",
      createStorefrontCompilerRouter(
        deps.storefrontCompilerApi,
        authProvider,
      ),
    );
  }

  if (
    deps.storefrontPublicationApi
  ) {
    app.use(
      "/api/stores/:storeId/storefront",
      createStorefrontPublicationRouter(
        deps.storefrontPublicationApi,
        authProvider,
      ),
    );
  }

  app.use(
    "/api/stores/:storeId/storefront",
    createStorefrontRouter(
      storefrontService,
      authProvider,
    ),
  );
}


/* -------------------------------------------------------------------------- */
/* Media                                                                      */
/* -------------------------------------------------------------------------- */

function createDefaultMediaStorage(
  config: AppConfig,
): MediaStorage {
  if (config.mediaProvider === "supabase") {
    if (
      !config.supabaseUrl ||
      !config.supabaseSecretKey
    ) {
      throw new Error(
        "Supabase media storage configuration is missing",
      );
    }

    return new SupabaseMediaStorage(
      config.supabaseUrl,
      config.supabaseSecretKey,
      config.supabaseMediaBucket,
    );
  }

  // Preserve the existing behavior for local-files and gcs.
  // A dedicated GCS MediaStorage implementation can replace this branch later.
  return new LocalMediaStorage(
    config.uploadDirectory,
  );
}

function mountMediaRoutes(
  app: Express,
  mediaService: MediaService,
  authProvider: AuthProvider,
  config: AppConfig,
): void {
  app.use(
    "/api/stores/:storeId/media",
    createMediaRouter(
      mediaService,
      authProvider,
      config.maxUploadBytes,
    ),
  );

  app.use(
    "/api/public/media",
    createPublicMediaRouter(
      mediaService,
    ),
  );
}


/* -------------------------------------------------------------------------- */
/* App                                                                        */
/* -------------------------------------------------------------------------- */

export function createApp(
  dependencies: Partial<AppDependencies> = {},
): Express {
  const config =
    dependencies.config ??
    loadConfig();

  const authProvider =
    dependencies.authProvider ??
    new DevelopmentAuthProvider(
      config.demoStoreId,
    );

  const storefrontRepository =
    dependencies.storefrontRepository ??
    new LocalJsonStorefrontRepository(
      config.dataDirectory,
    );

  const documentValidator =
    dependencies.documentValidator ??
    storefrontDocumentValidator;

  const storefrontService =
    new DefaultStorefrontService(
      storefrontRepository,
      documentValidator,
      createDefaultStorefrontDocument,
    );

  const publicStorefrontApi =
    dependencies.publicStorefrontApi ??
    defaultPublicStorefrontApi;

  const mediaRepository =
    dependencies.mediaRepository ??
    new LocalJsonMediaRepository(
      config.dataDirectory,
    );

  const mediaStorage =
    dependencies.mediaStorage ??
    createDefaultMediaStorage(
      config,
    );

  const mediaService =
    new MediaService(
      mediaRepository,
      mediaStorage,
    );

  const app = express();

  const catalogService =
    dependencies.catalogService ??
    (supabasePool ? new CatalogService(new CatalogPostgresRepository(supabasePool)) as CatalogAdmin : undefined);

  /* Base middleware */
  configureMiddleware(
    app,
    config,
  );

  /*
   * Stripe webhook routes MUST be mounted
   * before express.json(), because Stripe
   * signature verification requires raw bytes.
   */
  mountStripeWebhooks(
    app,
    dependencies,
  );

  /* Normal JSON API parsing starts here. */
  app.use(
    express.json({
      limit: "2mb",
    }),
  );

  mountInternalRoutes(
    app,
    dependencies,
    config,
  );

  mountTenantRoutes(
    app,
    dependencies,
    authProvider,
  );

  mountCommerceRoutes(
    app,
    dependencies,
    authProvider,
  );

  mountCatalogRoutes(
    app,
    { ...dependencies, catalogService },
    authProvider,
  );

  mountContentRoutes(
    app,
    dependencies,
    authProvider,
  );

  mountStorefrontRoutes(
    app,
    dependencies,
    authProvider,
    storefrontService,
    publicStorefrontApi,
  );

  mountMediaRoutes(
    app,
    mediaService,
    authProvider,
    config,
  );

  /* Error handling must stay last. */
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
