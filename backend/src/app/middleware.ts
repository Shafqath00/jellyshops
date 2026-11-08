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

  // How long each request took: "Server-Timing: app;dur=123" for the browser's network panel,
  // and a log line for anything slower than a second.
  app.use((request, response, next) => {
    const started = process.hrtime.bigint();
    const writeHead = response.writeHead;
    response.writeHead = function timedWriteHead(this: typeof response, ...args: Parameters<typeof writeHead>) {
      const ms = Number(process.hrtime.bigint() - started) / 1e6;
      if (!this.headersSent) this.setHeader("Server-Timing", `app;dur=${ms.toFixed(1)}`);
      if (ms > 1000) console.warn(JSON.stringify({ level: "warn", message: "slow request", method: request.method, path: request.path, ms: Math.round(ms), requestId: request.id }));
      return writeHead.apply(this, args);
    } as typeof writeHead;
    next();
  });

  app.use(
    cors({
      exposedHeaders: ["Server-Timing", "x-request-id"],
      // `CORS_ORIGINS=*` is intentionally supported for local/testing
      // deployments. The cors package reflects the request origin when
      // `origin: true`, which also keeps Authorization preflights working.
      origin: config.corsOrigins.includes("*")
        ? true
        : config.corsOrigins,
    }),
  );
}
