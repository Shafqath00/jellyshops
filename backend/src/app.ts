import express, { type Express } from "express";
import { resolveAppDependencies } from "./app/dependencies.js";
import { configureMiddleware } from "./app/middleware.js";
import { mountCommerceRoutes, mountOrderRuntimeRoutes, mountStripeWebhooks } from "./app/routes/commerce.js";
import { mountInternalRoutes } from "./app/routes/internal.js";
import { mountMediaRoutes } from "./app/routes/media.js";
import {
  mountAdminRoutes,
  mountCatalogRoutes,
  mountContentRoutes,
  mountCustomerRoutes,
  mountStoreSettingsRoutes,
  mountTenantRoutes,
} from "./app/routes/merchant.js";
import { mountPublicStorefrontContextRoutes, mountStorefrontRoutes } from "./app/routes/storefront.js";
import type { AppDependencies } from "./app/types.js";
import { errorHandler, notFoundHandler } from "./http/errors.js";
import { isThemePackageUpload } from "./storefront/theme-packages/routes.js";

export { publicDocumentFromTemplate } from "./app/default-storefront-workspace.js";
export type { AppDependencies } from "./app/types.js";

export function createApp(dependencies: Partial<AppDependencies> = {}): Express {
  const context = resolveAppDependencies(dependencies);
  const app = express();
  const { orderRuntime } = context.routeDependencies;
  if (orderRuntime) app.locals.runOrderWorkers = orderRuntime.runWorkers;

  configureMiddleware(app, context.config);

  // Stripe signatures require raw bytes, so mount webhooks before JSON parsing.
  mountStripeWebhooks(app, context);
  // Theme package uploads carry their files as base64 and get a larger limit of their own.
  const defaultJson = express.json({ limit: "2mb" });
  app.use((request, response, next) => isThemePackageUpload(request) ? next() : defaultJson(request, response, next));

  mountOrderRuntimeRoutes(app, context);
  mountStoreSettingsRoutes(app, context);
  mountCustomerRoutes(app, context);
  mountInternalRoutes(app, context);
  mountTenantRoutes(app, context);
  mountCommerceRoutes(app, context);
  mountAdminRoutes(app, context);
  mountCatalogRoutes(app, context);
  // One scheduled tick does the order work and then a step of any product import left running.
  const continueImports = app.locals.continueProductImports as undefined | (() => Promise<unknown>);
  if (continueImports) {
    const orderWork = app.locals.runOrderWorkers as undefined | (() => Promise<unknown>);
    app.locals.runOrderWorkers = async () => {
      const result = orderWork ? await orderWork() : {};
      const imports = await continueImports().catch(() => ({ continued: 0, finished: 0 }));
      return { ...(result as object), imports };
    };
  }
  mountPublicStorefrontContextRoutes(app, context);
  mountContentRoutes(app, context);
  mountStorefrontRoutes(app, context);
  mountMediaRoutes(app, context);

  // Error handling must stay last.
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
