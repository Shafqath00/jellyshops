import type express from "express";
import type { AdminSummaryService, CustomerService } from "../admin/service.js";
import type { AuthProvider } from "../auth/types.js";
import type { CatalogAdmin } from "../catalog/service.js";
import type { MerchantOrderService } from "../commerce/merchant-orders.js";
import type { OrderRuntime } from "../commerce/order-runtime.js";
import type { CommerceDatabase, CommerceRepository, SqlExecutor } from "../commerce/repository.js";
import type { CheckoutService } from "../commerce/service.js";
import type { ReservationSweeper } from "../commerce/sweeper.js";
import type { AppConfig } from "../config.js";
import type { ContentService } from "../content/service.js";
import type { CustomDataService, MetaobjectService } from "../custom-data/service.js";
import type { supabaseCustomerVerifier } from "../customers/routes.js";
import type { CustomerService as StoreCustomerService } from "../customers/service.js";
import type { DynamicSourceRegistry } from "../dynamic-sources/registry.js";
import type { MediaRepository } from "../media/repository.js";
import type { MediaService } from "../media/service.js";
import type { MediaStorage } from "../media/storage.js";
import type { StorefrontCompilerApi } from "../storefront/compiler/routes.js";
import type { CompilerDynamicSourceResolver } from "../storefront/compiler/types.js";
import type { PublicStorefrontContextService } from "../storefront/context/service.js";
import type { StorefrontPublicationApi } from "../storefront/publication/routes.js";
import type { StorefrontRepository } from "../storefront/repository.js";
import type { PublicStorefrontApi } from "../storefront/routes.js";
import type { DefaultStorefrontService, DocumentValidator } from "../storefront/service.js";
import type { StorefrontStarterApi } from "../storefront/starter/routes.js";
import type { StorefrontWorkspaceApi } from "../storefront/workspace/routes.js";
import type { StripeAccountService } from "../stripe/accounts/service.js";
import type { StripeGateway } from "../stripe/client.js";
import type { TenantRepository } from "../tenants/repository.js";

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
  storefrontSql: SqlExecutor | null;
  storefrontDynamicSourceResolver: CompilerDynamicSourceResolver;
  storefrontPublicationApi: StorefrontPublicationApi;
  publicStorefrontApi: PublicStorefrontApi;
  storefrontStarterApi?: StorefrontStarterApi;

  // Stripe / commerce
  stripeAccountService?: StripeAccountService;
  checkoutService?: CheckoutService;
  resolveCheckoutCustomer?: (request: express.Request) => Promise<string | undefined>;
  stripeGateway?: StripeGateway;
  webhookSql?: SqlExecutor;
  reservationSweeper?: ReservationSweeper;
  merchantOrderService?: MerchantOrderService;
  commerceDatabase?: CommerceDatabase;
  orderRuntime?: OrderRuntime;
}

export interface AppContext {
  config: AppConfig;
  authProvider: AuthProvider;
  routeDependencies: Partial<AppDependencies>;
  catalogService: CatalogAdmin | undefined;
  storefrontService: DefaultStorefrontService<unknown>;
  publicStorefrontApi: PublicStorefrontApi;
  storefrontStarterApi: StorefrontStarterApi | undefined;
  mediaService: MediaService;
  publicStorefrontContextService: PublicStorefrontContextService | undefined;
  adminServices: { summary: AdminSummaryService; customers: CustomerService } | undefined;
  commerceRepository: CommerceRepository | undefined;
  customerService: StoreCustomerService | undefined;
  verifyCustomer: ReturnType<typeof supabaseCustomerVerifier> | undefined;
}
