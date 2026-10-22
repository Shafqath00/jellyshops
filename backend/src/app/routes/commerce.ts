import type { Express } from "express";
import { createMerchantOrderRouter } from "../../commerce/merchant-order-routes.js";
import {
  createDigitalProductRouter,
  createNotificationRouter,
  createOrderNotificationRouter,
  createPublicDigitalRouter,
} from "../../commerce/notification-routes.js";
import { createOrderWorkerRouter } from "../../commerce/order-runtime.js";
import { createCommerceRouter, createPublicOrderRouter } from "../../commerce/routes.js";
import { createStripeConnectRouter } from "../../stripe/accounts/routes.js";
import { createAccountsV2WebhookRouter } from "../../stripe/webhooks/accounts-v2-route.js";
import { createConnectPaymentsWebhookRouter } from "../../stripe/webhooks/connect-payments-route.js";
import type { AppContext } from "../types.js";

export function mountStripeWebhooks(app: Express, context: AppContext): void {
  const { routeDependencies: deps } = context;

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
        { database: deps.commerceDatabase, hooks: deps.orderRuntime?.hooks },
      ),
    );
  }
}

export function mountOrderRuntimeRoutes(app: Express, context: AppContext): void {
  const { config, authProvider } = context;
  const { orderRuntime, merchantOrderService, checkoutService } = context.routeDependencies;
  if (orderRuntime) {
    if (orderRuntime.notifications) {
      app.use("/api/stores/:storeId/order-notifications", createNotificationRouter(orderRuntime.notifications, authProvider));
      app.use("/api/stores/:storeId/orders", createOrderNotificationRouter(orderRuntime.notifications, authProvider));
    }
    if (orderRuntime.digital) {
      app.use("/api/stores/:storeId/digital-products", createDigitalProductRouter(orderRuntime.digital, authProvider));
      app.use("/api/public/stores/:storeId/digital", createPublicDigitalRouter(orderRuntime.digital));
    }
    if (config.stripe?.schedulerSecret) app.use("/internal/commerce/orders/work", createOrderWorkerRouter(orderRuntime.runWorkers, config.stripe.schedulerSecret));
    if (merchantOrderService && checkoutService) app.get("/api/public/stores/:storeId/orders/:publicToken/balance", async (req, res, next) => {
      try {
        res.setHeader("Cache-Control", "no-store");
        await checkoutService.assertPublicOrderAccess(String(req.params.storeId), req.ip || "unknown");
        res.json(await merchantOrderService.management.getPublicBalance(String(req.params.storeId), String(req.params.publicToken)));
      } catch (error) { next(error); }
    });
  }
}

export function mountCommerceRoutes(app: Express, context: AppContext): void {
  const { routeDependencies: deps, authProvider } = context;

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
        deps.resolveCheckoutCustomer,
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
