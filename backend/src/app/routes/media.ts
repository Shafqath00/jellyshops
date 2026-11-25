import type { Express } from "express";
import { createMediaRouter, createPublicMediaRouter } from "../../media/routes.js";
import type { AppContext } from "../types.js";

export function mountMediaRoutes(app: Express, context: AppContext): void {
  const { mediaService, authProvider, config } = context;
  const { planLimits } = context.routeDependencies;

  app.use(
    "/api/stores/:storeId/media",
    createMediaRouter(
      mediaService,
      authProvider,
      config.maxUploadBytes,
      planLimits,
    ),
  );

  app.use(
    "/api/public/media",
    createPublicMediaRouter(
      mediaService,
    ),
  );
}
