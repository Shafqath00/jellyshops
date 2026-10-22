import cors from "cors";
import type { Express } from "express";
import { randomUUID } from "node:crypto";
import { type AppConfig } from "../config.js";

declare global {
  namespace Express {
    interface Request {
      id: string;
    }
  }
}

export function configureMiddleware(
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
      // `CORS_ORIGINS=*` is intentionally supported for local/testing
      // deployments. The cors package reflects the request origin when
      // `origin: true`, which also keeps Authorization preflights working.
      origin: config.corsOrigins.includes("*")
        ? true
        : config.corsOrigins,
    }),
  );
}
