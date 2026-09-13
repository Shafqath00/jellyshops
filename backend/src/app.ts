import { randomUUID } from "node:crypto";
import cors from "cors";
import express, { type Express } from "express";
import { loadConfig, type AppConfig } from "./config.js";
import { DevelopmentAuthProvider } from "./auth/development-auth-provider.js";
import type { AuthProvider } from "./auth/types.js";
import { createCatalogRouter } from "./catalog/routes.js";
import { errorHandler, notFoundHandler } from "./http/errors.js";
import { LocalJsonMediaRepository } from "./media/local-json-media-repository.js";
import { LocalMediaStorage } from "./media/local-media-storage.js";
import type { MediaRepository } from "./media/repository.js";
import { createMediaRouter, createPublicMediaRouter } from "./media/routes.js";
import { MediaService } from "./media/service.js";
import type { MediaStorage } from "./media/storage.js";
import { LocalJsonStorefrontRepository } from "./storefront/local-json-repository.js";
import { createDefaultStorefrontDocument, storefrontDocumentValidator } from "./storefront/document-validator.js";
import { createStorefrontRouter } from "./storefront/routes.js";
import { DefaultStorefrontService, type DocumentValidator } from "./storefront/service.js";
import type { StorefrontRepository } from "./storefront/repository.js";
import { createMerchantRouter } from "./tenants/routes.js";
import type { TenantRepository } from "./tenants/repository.js";

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
}

export function createApp(dependencies: Partial<AppDependencies> = {}): Express {
  const config = dependencies.config ?? loadConfig();
  const authProvider = dependencies.authProvider ?? new DevelopmentAuthProvider(config.demoStoreId);
  const storefrontRepository = dependencies.storefrontRepository ?? new LocalJsonStorefrontRepository(config.dataDirectory);
  const documentValidator = dependencies.documentValidator ?? storefrontDocumentValidator;
  const storefrontService = new DefaultStorefrontService(
    storefrontRepository,
    documentValidator,
    createDefaultStorefrontDocument,
  );
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

  app.get("/health", (_request, response) => {
    response.json({ ok: true });
  });

  app.use("/api/demo/catalog", createCatalogRouter());
  if (dependencies.tenantRepository) {
    app.use("/api", createMerchantRouter(authProvider, dependencies.tenantRepository));
  }
  app.use(
    "/api/stores/:storeId/storefront",
    createStorefrontRouter(storefrontService, authProvider),
  );
  app.use(
    "/api/stores/:storeId/media",
    createMediaRouter(mediaService, authProvider, config.maxUploadBytes),
  );
  app.use("/api/public/media", createPublicMediaRouter(mediaService));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
