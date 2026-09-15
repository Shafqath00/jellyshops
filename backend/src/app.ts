import { randomUUID } from "node:crypto";
import { createSupabasePool } from "./database/client.js";
import cors from "cors";
import express, { type Express } from "express";
import { loadConfig, type AppConfig } from "./config.js";
import { DevelopmentAuthProvider } from "./auth/development-auth-provider.js";
import type { AuthProvider } from "./auth/types.js";
import { createCatalogAdminRouter, createCatalogRouter, createPublicCatalogRouter } from "./catalog/routes.js";
import type { CatalogAdmin } from "./catalog/service.js";
import { createContentRouter } from "./content/routes.js";
import type { ContentService } from "./content/service.js";
import { createCustomDataRouter } from "./custom-data/routes.js";
import type { CustomDataService, MetaobjectService } from "./custom-data/service.js";
import type { DynamicSourceRegistry } from "./dynamic-sources/registry.js";
import { requireMerchant, requireStorePermission } from "./auth/middleware.js";
import { errorHandler, notFoundHandler } from "./http/errors.js";
import { LocalJsonMediaRepository } from "./media/local-json-media-repository.js";
import { LocalMediaStorage } from "./media/local-media-storage.js";
import type { MediaRepository } from "./media/repository.js";
import { createMediaRouter, createPublicMediaRouter } from "./media/routes.js";
import { MediaService } from "./media/service.js";
import type { MediaStorage } from "./media/storage.js";
import { createStorefrontCompilerRouter, type StorefrontCompilerApi } from "./storefront/compiler/routes.js";
import { LocalJsonStorefrontRepository } from "./storefront/local-json-repository.js";
import { createDefaultStorefrontDocument, storefrontDocumentValidator } from "./storefront/document-validator.js";
import { createStorefrontPublicationRouter, type StorefrontPublicationApi } from "./storefront/publication/routes.js";
import { createStorefrontRouter } from "./storefront/routes.js";
import { DefaultStorefrontService, type DocumentValidator } from "./storefront/service.js";
import type { StorefrontRepository } from "./storefront/repository.js";
import { createStorefrontWorkspaceRouter, type StorefrontWorkspaceApi } from "./storefront/workspace/routes.js";
import { updateSupabaseTemplate } from "./storefront/workspace/supabase-template-store.js";
import { createMerchantRouter } from "./tenants/routes.js";
import type { TenantRepository } from "./tenants/repository.js";
import type { GlobalSettings, SectionNode, StorefrontDocument, ThemeId } from "@jelly/storefront-schema";

declare global {
  namespace Express {
    interface Request {
      id: string;
    }
  }
}

export interface AppDependencies {
  config: AppConfig;
  authProvider: AuthProvider;
  storefrontRepository: StorefrontRepository<unknown>;
  documentValidator: DocumentValidator<unknown>;
  tenantRepository: TenantRepository;
  mediaRepository: MediaRepository;
  mediaStorage: MediaStorage;
  catalogService: CatalogAdmin;
  contentService: ContentService;
  customDataService: CustomDataService;
  metaobjectService: MetaobjectService;
  dynamicSourceRegistry: DynamicSourceRegistry;
  storefrontWorkspaceApi: StorefrontWorkspaceApi;
  storefrontCompilerApi: StorefrontCompilerApi;
  storefrontPublicationApi: StorefrontPublicationApi;
  publicStorefrontApi: PublicStorefrontApi;
}

export interface PublicStorefrontApi {
  load(storeId: string): Promise<{ id: string; document: StorefrontDocument }>;
}

const defaultHomeTemplate = {
  id: "home",
  storeId: "store-demo",
  revision: 1,
  type: "home" as const,
  handle: "home",
  name: "Home page",
  layout: {
    sections: [{
      kind: "inline",
      section: {
        id: "welcome",
        type: "hero",
        enabled: true,
        settings: {},
        blocks: [{ id: "welcome-heading", type: "heading", enabled: true, settings: { text: "Welcome" } }],
      },
    }],
  },
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

const supabasePool = process.env.SUPABASE_DATABASE_URL ? createSupabasePool() : undefined;

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function themeId(value: unknown): ThemeId | undefined {
  return value === "minimal" || value === "classic" || value === "bold" || value === "elegant" || value === "playful" || value === "fresh-market" || value === "artisan-boutique"
    ? value
    : undefined;
}

function section(value: unknown): SectionNode | undefined {
  const candidate = record(value);
  if (!candidate || typeof candidate.id !== "string" || typeof candidate.type !== "string" || typeof candidate.enabled !== "boolean" || !record(candidate.settings) || !Array.isArray(candidate.blocks)) return undefined;
  return candidate as unknown as SectionNode;
}

/** Converts the editor-owned Home template into the document consumed by the public storefront. */
export function publicDocumentFromTemplate(storeId: string, layout: unknown): StorefrontDocument {
  const source = record(layout);
  const sourceTheme = record(source?.theme);
  const selectedTheme = themeId(sourceTheme?.id) ?? "minimal";
  const fallback = createDefaultStorefrontDocument(storeId, selectedTheme);
  const settings = record(sourceTheme?.settings) as GlobalSettings | undefined;
  const inlineSections = Array.isArray(source?.sections)
    ? source.sections.flatMap((placement) => {
      const item = record(placement);
      return item?.kind === "inline" ? [section(item.section)].filter((value): value is SectionNode => Boolean(value)) : [];
    })
    : [];
  const templateSections = inlineSections.length > 0 ? inlineSections : fallback.regions.template;
  return {
    ...fallback,
    theme: { presetId: selectedTheme, settings: settings ?? fallback.theme.settings },
    regions: { ...fallback.regions, template: templateSections },
    pages: fallback.pages.map((page) => page.type === "home" ? { ...page, sections: templateSections } : page),
  };
}

const defaultPublicStorefrontApi: PublicStorefrontApi = {
  async load(storeId) {
    if (!supabasePool) return { id: `publication-${storeId}`, document: createDefaultStorefrontDocument(storeId) };
    const result = await supabasePool.query(
      'SELECT "id", "revision", "layout" FROM "StorefrontTemplate" WHERE "storeId" = $1 AND lower("type"::text) = \'home\' ORDER BY "updatedAt" DESC LIMIT 1',
      [storeId],
    );
    const template = result.rows[0];
    if (!template) return { id: `publication-${storeId}`, document: createDefaultStorefrontDocument(storeId) };
    return {
      id: `template-${template.id}-r${template.revision}`,
      document: publicDocumentFromTemplate(storeId, template.layout),
    };
  },
};

const defaultStorefrontWorkspaceApi: StorefrontWorkspaceApi = {
  getWorkspace: async (storeId) => {
    if (!supabasePool) return { generation: 0, updatedAt: new Date(0) };
    const result = await supabasePool.query('SELECT "generation", "updatedAt" FROM "StorefrontWorkspace" WHERE "storeId" = $1', [storeId]);
    return result.rows[0] ?? { generation: 0, updatedAt: new Date(0) };
  },
  listTemplates: async (storeId) => {
    if (!supabasePool) return [defaultHomeTemplate];
    const result = await supabasePool.query('SELECT "id", "storeId", "revision", lower("type"::text) AS "type", "handle", "name", "layout", "createdAt", "updatedAt" FROM "StorefrontTemplate" WHERE "storeId" = $1 ORDER BY "createdAt"', [storeId]);
    return result.rows;
  },
  getTemplate: async (storeId, templateId) => {
    if (!supabasePool) return templateId === defaultHomeTemplate.id ? defaultHomeTemplate : null;
    const result = await supabasePool.query('SELECT "id", "storeId", "revision", lower("type"::text) AS "type", "handle", "name", "layout", "createdAt", "updatedAt" FROM "StorefrontTemplate" WHERE "storeId" = $1 AND "id" = $2', [storeId, templateId]);
    return result.rows[0] ?? null;
  }, createTemplate: async (_storeId, input) => input,
  updateTemplate: async (storeId, templateId, revision, patch) => {
    if (supabasePool) return updateSupabaseTemplate(supabasePool, storeId, templateId, revision, patch);
    return {
      template: { ...defaultHomeTemplate, id: templateId, revision: revision + 1, ...patch, updatedAt: new Date() },
      generation: 1,
    };
  },
  cloneTemplate: async (_storeId, templateId, input) => ({ id: templateId, ...input }),
  listGlobalSections: async (storeId) => {
    if (!supabasePool) return [];
    const result = await supabasePool.query('SELECT "id", "storeId", "revision", "name", "section", "createdAt", "updatedAt" FROM "GlobalSection" WHERE "storeId" = $1 ORDER BY "createdAt"', [storeId]);
    return result.rows;
  }, getGlobalSection: async () => null, createGlobalSection: async (_storeId, input) => input,
  updateGlobalSection: async (_storeId, id, _revision, patch) => ({ id, ...patch }),
  listPresets: async (storeId) => {
    if (!supabasePool) return [];
    const result = await supabasePool.query('SELECT "id", "storeId", "revision", "name", "section", "createdAt", "updatedAt" FROM "SectionPreset" WHERE "storeId" = $1 ORDER BY "createdAt"', [storeId]);
    return result.rows;
  }, createPreset: async (_storeId, input) => input,
  instantiatePreset: async () => ({}),
  listMenus: async () => [], getMenu: async () => null, createMenu: async (_storeId, input) => input,
  updateMenu: async (_storeId, id, _revision, patch) => ({ id, ...patch }),
  getThemeConfiguration: async () => null, saveThemeConfiguration: async (_storeId, _revision, input) => input,
  getAssignment: async () => null, assignTemplate: async (_storeId, input) => input,
};

export function createApp(dependencies: Partial<AppDependencies> = {}): Express {
  const config = dependencies.config ?? loadConfig();
  const authProvider = dependencies.authProvider ?? new DevelopmentAuthProvider(config.demoStoreId);
  const storefrontRepository = dependencies.storefrontRepository ?? new LocalJsonStorefrontRepository(config.dataDirectory);
  const documentValidator = dependencies.documentValidator ?? storefrontDocumentValidator;
  const storefrontService = new DefaultStorefrontService(storefrontRepository, documentValidator, createDefaultStorefrontDocument);
  const publicStorefrontApi = dependencies.publicStorefrontApi ?? defaultPublicStorefrontApi;
  const mediaRepository = dependencies.mediaRepository ?? new LocalJsonMediaRepository(config.dataDirectory);
  const mediaStorage = dependencies.mediaStorage ?? new LocalMediaStorage(config.uploadDirectory);
  const mediaService = new MediaService(mediaRepository, mediaStorage);
  const app = express();

  app.disable("x-powered-by");
  app.use((request, response, next) => {
    request.id = randomUUID();
    response.setHeader("x-request-id", request.id);
    next();
  });
  app.use(cors({ origin: config.corsOrigins }));
  app.use(express.json({ limit: "2mb" }));

  app.get("/health", (_request, response) => response.json({ ok: true }));

  app.use("/api/demo/catalog", createCatalogRouter());
  if (dependencies.catalogService) {
    app.use("/api/stores/:storeId/catalog", createCatalogAdminRouter(dependencies.catalogService, authProvider));
    app.use("/api/public/stores/:storeId/catalog", createPublicCatalogRouter(dependencies.catalogService));
  }
  if (dependencies.contentService) {
    app.use("/api/stores/:storeId/content", createContentRouter(dependencies.contentService, authProvider));
  }
  if (dependencies.customDataService && dependencies.metaobjectService && dependencies.dynamicSourceRegistry) {
    app.use(
      "/api/stores/:storeId/custom-data",
      createCustomDataRouter({
        customData: dependencies.customDataService,
        metaobjects: dependencies.metaobjectService,
        registry: dependencies.dynamicSourceRegistry,
      }, authProvider),
    );
  }
  app.get(
    "/api/stores/:storeId/custom-data/dynamic-sources",
    requireMerchant(authProvider),
    requireStorePermission("storefront:view"),
    (_request, response) => response.json([{ id: "resource:store:name", label: "Store name", valueType: "string", requiredContext: "any", binding: { kind: "resource_field", resource: "store", field: "name" } }]),
  );
  app.post(
    "/api/stores/:storeId/storefront/publish",
    requireMerchant(authProvider),
    requireStorePermission("storefront:edit"),
    async (request, response, next) => {
      try {
        const storeId = request.storeContext!.storeId;
        const generation = Number(request.body?.expectedGeneration ?? 0);
        if (supabasePool) {
          await supabasePool.query(
            'UPDATE "StorefrontWorkspace" SET "generation" = GREATEST("generation", $1), "updatedAt" = NOW() WHERE "storeId" = $2',
            [generation, storeId],
          );
        }
        response.json({ ok: true, publication: { id: `publication-${storeId}-${generation}`, storeId, sourceGeneration: generation }, diagnostics: [] });
      } catch (error) { next(error); }
    },
  );
  for (const path of ["validate", "preview/compile"]) {
    app.post(
      `/api/stores/:storeId/storefront/${path}`,
      requireMerchant(authProvider),
      requireStorePermission("storefront:view"),
      (_request, response) => response.json({ ok: true, diagnostics: [], dependencies: {} }),
    );
  }
  app.get("/api/stores/:storeId/storefront/public", async (request, response, next) => {
    try {
      response.json(await publicStorefrontApi.load(String(request.params.storeId)));
    } catch (error) { next(error); }
  });
  if (dependencies.tenantRepository) app.use("/api", createMerchantRouter(authProvider, dependencies.tenantRepository));

  app.use(
    "/api/stores/:storeId/storefront",
    createStorefrontWorkspaceRouter(dependencies.storefrontWorkspaceApi ?? defaultStorefrontWorkspaceApi, authProvider),
  );
  if (dependencies.storefrontCompilerApi) {
    app.use(
      "/api/stores/:storeId/storefront",
      createStorefrontCompilerRouter(dependencies.storefrontCompilerApi, authProvider),
    );
  }
  if (dependencies.storefrontPublicationApi) {
    app.use(
      "/api/stores/:storeId/storefront",
      createStorefrontPublicationRouter(dependencies.storefrontPublicationApi, authProvider),
    );
  }
  app.use("/api/stores/:storeId/storefront", createStorefrontRouter(storefrontService, authProvider));
  app.use("/api/stores/:storeId/media", createMediaRouter(mediaService, authProvider, config.maxUploadBytes));
  app.use("/api/public/media", createPublicMediaRouter(mediaService));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
