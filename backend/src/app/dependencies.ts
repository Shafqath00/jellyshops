import type express from "express";
import { AdminSummaryService, CustomerService } from "../admin/service.js";
import { DevelopmentAuthProvider } from "../auth/development-auth-provider.js";
import { FirebaseAuthProvider } from "../auth/firebase-auth-provider.js";
import { createFirebaseTokenVerifier } from "../auth/firebase-token-verifier.js";
import { SupabaseAuthProvider } from "../auth/supabase-auth-provider.js";
import type { AuthProvider } from "../auth/types.js";
import { CatalogPostgresRepository } from "../catalog/postgres-repository.js";
import type { CatalogAdmin } from "../catalog/service.js";
import { CatalogService } from "../catalog/service.js";
import { MerchantOrderService } from "../commerce/merchant-orders.js";
import { createOrderRuntime } from "../commerce/order-runtime.js";
import { CommerceRepository, postgresCommerceDatabase, type CommerceDatabase, type SqlExecutor } from "../commerce/repository.js";
import { CheckoutService } from "../commerce/service.js";
import { ReservationSweeper } from "../commerce/sweeper.js";
import { loadConfig, type AppConfig } from "../config.js";
import { ContentService } from "../content/service.js";
import { SqlContentRepository } from "../content/sql-repository.js";
import { CustomDataService, MetaobjectService } from "../custom-data/service.js";
import { SqlCustomDataRepository } from "../custom-data/sql-repository.js";
import { customerIdentity, supabaseCustomerVerifier } from "../customers/routes.js";
import { CustomerService as StoreCustomerService } from "../customers/service.js";
import { DynamicSourceRegistry } from "../dynamic-sources/registry.js";
import { LocalJsonMediaRepository } from "../media/local-json-media-repository.js";
import { LocalMediaStorage } from "../media/local-media-storage.js";
import { MediaService } from "../media/service.js";
import { SqlMediaRepository } from "../media/sql-media-repository.js";
import type { MediaStorage } from "../media/storage.js";
import { createStorefrontMediaReferenceReader } from "../media/storefront-reference-reader.js";
import { SupabaseMediaStorage } from "../media/supabase-media-storage.js";
import { PublicStorefrontContextService } from "../storefront/context/service.js";
import { SqlPublicStorefrontContextRepository } from "../storefront/context/sql-repository.js";
import { createDefaultStorefrontDocument, storefrontDocumentValidator } from "../storefront/document-validator.js";
import { LocalJsonStorefrontRepository } from "../storefront/local-json-repository.js";
import { createLocalV4CompilationService } from "../storefront/local-v4-compilation.js";
import { type StorefrontPublicationApi } from "../storefront/publication/routes.js";
import { CompiledStorefrontPublicationService, type StorefrontCompilerPublisherApi } from "../storefront/publication/service.js";
import { SqlCompiledPublicationRepository } from "../storefront/publication/sql-repository.js";
import { type PublicStorefrontApi } from "../storefront/routes.js";
import { ImmutablePublicationCache, StorefrontRuntimeService } from "../storefront/runtime/service.js";
import { DefaultStorefrontService } from "../storefront/service.js";
import { StorefrontStarterInstallationService } from "../storefront/starter/installation-service.js";
import { createSqlWorkspaceApi } from "../storefront/workspace/sql-repositories.js";
import { StripeAccountService } from "../stripe/accounts/service.js";
import { createStripeGateway, type StripeGateway } from "../stripe/client.js";
import { PostgresTenantRepository } from "../tenants/postgres-repository.js";
import { StoreSettingsRepository } from "../tenants/settings.js";
import { supabasePool } from "./database.js";
import type { AppContext, AppDependencies } from "./types.js";

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

export function resolveAppDependencies(dependencies: Partial<AppDependencies> = {}): AppContext {
  const config =
    dependencies.config ??
    loadConfig();

  function buildDefaultAuthProvider(): AuthProvider {
    if (config.authProvider === "firebase") {
      if (!config.firebaseProjectId || !supabasePool) {
        throw new Error(
          "AUTH_PROVIDER=firebase requires JELLY_FIREBASE_PROJECT_ID and SUPABASE_DATABASE_URL",
        );
      }
      return new FirebaseAuthProvider(
        createFirebaseTokenVerifier(config.firebaseProjectId),
        new PostgresTenantRepository(supabasePool),
      );
    }
    if (config.authProvider === "supabase") {
      if (!config.supabaseUrl || !config.supabaseAnonKey || !supabasePool) {
        throw new Error(
          "AUTH_PROVIDER=supabase requires SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_DATABASE_URL",
        );
      }
      return new SupabaseAuthProvider(
        config.supabaseUrl,
        config.supabaseAnonKey,
        new PostgresTenantRepository(supabasePool),
      );
    }
    return new DevelopmentAuthProvider(config.demoStoreId);
  }

  const authProvider =
    dependencies.authProvider ??
    buildDefaultAuthProvider();

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

  const mediaRepository =
    dependencies.mediaRepository ??
    (supabasePool ? new SqlMediaRepository(supabasePool) : new LocalJsonMediaRepository(
      config.dataDirectory,
    ));

  const mediaStorage =
    dependencies.mediaStorage ??
    createDefaultMediaStorage(
      config,
    );

  const catalogService =
    dependencies.catalogService ??
    (supabasePool
      ? (() => {
        const catalogRepository = new CatalogPostgresRepository(supabasePool, postgresCommerceDatabase(supabasePool));
        return new CatalogService(catalogRepository, catalogRepository) as CatalogAdmin;
      })()
      : undefined);

  const tenantRepository =
    dependencies.tenantRepository ??
    (supabasePool ? new PostgresTenantRepository(supabasePool) : undefined);

  const stripeGateway: StripeGateway | undefined =
    dependencies.stripeGateway ??
    (config.stripe ? createStripeGateway(config) : undefined);

  const commerceDatabase: CommerceDatabase | undefined =
    dependencies.commerceDatabase ?? (supabasePool
      ? postgresCommerceDatabase(supabasePool)
      : undefined);

  const commerceRepository =
    commerceDatabase
      ? new CommerceRepository(commerceDatabase)
      : undefined;

  const webhookSql: SqlExecutor | undefined =
    dependencies.webhookSql ??
    supabasePool;

  const configuredStorefrontPool =
    supabasePool && typeof supabasePool.connect === "function"
      ? supabasePool
      : undefined;

  const storefrontSql: SqlExecutor | undefined =
    dependencies.storefrontSql === null
      ? undefined
      : dependencies.storefrontSql ??
      configuredStorefrontPool;

  const mediaService = new MediaService(
    mediaRepository,
    mediaStorage,
    storefrontSql ? createStorefrontMediaReferenceReader(storefrontSql) : undefined,
  );

  const contentService =
    dependencies.contentService ??
    (storefrontSql
      ? new ContentService(new SqlContentRepository(storefrontSql))
      : undefined);

  const publicStorefrontContextService =
    storefrontSql && catalogService
      ? new PublicStorefrontContextService(
        new SqlPublicStorefrontContextRepository(storefrontSql),
        catalogService,
      )
      : undefined;

  const customDataRepository = storefrontSql ? new SqlCustomDataRepository(storefrontSql) : undefined;

  const dynamicSourceRegistry = dependencies.dynamicSourceRegistry ?? (customDataRepository ? new DynamicSourceRegistry(customDataRepository, customDataRepository) : undefined);

  const storefrontCompilerApi =
    dependencies.storefrontCompilerApi ??
    (storefrontSql
      ? createLocalV4CompilationService(
        storefrontSql,
        dependencies.storefrontDynamicSourceResolver ??
        dynamicSourceRegistry,
      )
      : undefined);

  const storefrontStarterApi = dependencies.storefrontStarterApi ??
    (storefrontSql && commerceDatabase ? new StorefrontStarterInstallationService(commerceDatabase) : undefined);

  let composedStorefrontPublicationApi: StorefrontPublicationApi | undefined;

  let composedPublicStorefrontApi: PublicStorefrontApi | undefined;

  if (
    storefrontSql &&
    storefrontCompilerApi &&
    (!dependencies.storefrontPublicationApi || !dependencies.publicStorefrontApi)
  ) {
    const publications = new SqlCompiledPublicationRepository(
      storefrontSql,
    );

    if (!dependencies.storefrontPublicationApi) {
      composedStorefrontPublicationApi = new CompiledStorefrontPublicationService(
        storefrontCompilerApi as StorefrontCompilerPublisherApi,
        publications,
      );
    }

    if (!dependencies.publicStorefrontApi) {
      const runtime = new StorefrontRuntimeService(
        publications,
        new ImmutablePublicationCache(publications),
      );
      composedPublicStorefrontApi = {
        async load(storeId) {
          const current = await runtime.getPublishedPublication(storeId);
          if (!current) return null;
          return { id: current.id, document: current.snapshot };
        },
      };
    }
  }

  const storefrontPublicationApi =
    dependencies.storefrontPublicationApi ??
    composedStorefrontPublicationApi;

  const publicStorefrontApi: PublicStorefrontApi =
    dependencies.publicStorefrontApi ??
    composedPublicStorefrontApi ?? {
      async load() {
        return null;
      },
    };

  const stripeAccountService: StripeAccountService | undefined =
    dependencies.stripeAccountService ??
    (stripeGateway && webhookSql
      ? new StripeAccountService({
        gateway: stripeGateway,
        sql: webhookSql,
        database: commerceDatabase,
      })
      : undefined);

  const checkoutService: CheckoutService | undefined =
    dependencies.checkoutService ??
    (commerceRepository && stripeGateway && stripeAccountService && catalogService
      ? new CheckoutService({
        repository: commerceRepository,
        catalog: catalogService,
        stripeAccountService,
        stripeGateway,
        enhancedSnapshots: true,
        isTest: !config.stripe?.secretKey.includes("_live_"),
        checkoutPolicy: new StoreSettingsRepository(commerceDatabase!),
        enabledCountries: config.stripe?.secretKey.includes("_live_")
          ? (process.env.LIVE_CHECKOUT_COUNTRIES ?? "").split(",").map((country) => country.trim()).filter(Boolean)
          : ["IN", "GB", "US"],
      })
      : undefined);

  const merchantOrderService: MerchantOrderService | undefined =
    dependencies.merchantOrderService ??
    (commerceRepository && stripeGateway
      ? new MerchantOrderService(commerceRepository, stripeGateway)
      : undefined);

  const orderRuntime = dependencies.orderRuntime ?? (commerceDatabase && merchantOrderService
    ? createOrderRuntime(commerceDatabase, merchantOrderService, config) : undefined);

  const adminServices = commerceRepository
    ? {
      summary: new AdminSummaryService(commerceRepository, async (storeId) => {
        if (!stripeAccountService || !commerceDatabase) return false;
        const policy = await new StoreSettingsRepository(commerceDatabase).getCheckoutPolicy(storeId);
        const enabledCountries = config.stripe?.secretKey.includes("_live_")
          ? (process.env.LIVE_CHECKOUT_COUNTRIES ?? "").split(",").map((country) => country.trim())
          : ["IN", "GB", "US"];
        return enabledCountries.includes(policy.country) && stripeAccountService.getLivePaymentReadiness(storeId);
      }),
      customers: new CustomerService(commerceRepository),
    }
    : undefined;

  const reservationSweeper: ReservationSweeper | undefined =
    dependencies.reservationSweeper ??
    (commerceRepository && stripeGateway
      ? new ReservationSweeper(commerceRepository, stripeGateway)
      : undefined);

  const customerService = commerceDatabase ? new StoreCustomerService(commerceDatabase, process.env.CUSTOMER_LINK_SECRET) : undefined;

  const verifyCustomer = config.supabaseUrl && config.supabaseAnonKey ? supabaseCustomerVerifier(config.supabaseUrl, config.supabaseAnonKey) : undefined;

  const commerceDeps = {
    ...dependencies,
    resolveCheckoutCustomer: customerService && verifyCustomer ? async (request: express.Request) => {
      if (!request.header("authorization")) return undefined;
      return (await customerService.profile(String(request.params.storeId), await customerIdentity(request, verifyCustomer))).id;
    } : undefined,
    customDataService: dependencies.customDataService ?? (customDataRepository ? new CustomDataService(customDataRepository) : undefined),
    metaobjectService: dependencies.metaobjectService ?? (customDataRepository ? new MetaobjectService(customDataRepository) : undefined),
    dynamicSourceRegistry,
    storefrontWorkspaceApi: dependencies.storefrontWorkspaceApi ?? (commerceDatabase ? createSqlWorkspaceApi(commerceDatabase) : undefined),
    storefrontCompilerApi,
    storefrontPublicationApi,
    publicStorefrontApi,
    stripeGateway,
    webhookSql,
    checkoutService,
    stripeAccountService,
    merchantOrderService,
    commerceDatabase,
    orderRuntime,
    reservationSweeper,
    tenantRepository,
    contentService,
  };

  return { config, authProvider, routeDependencies: commerceDeps, catalogService, storefrontService, publicStorefrontApi, storefrontStarterApi, mediaService, publicStorefrontContextService, adminServices, commerceRepository, customerService, verifyCustomer };
}
