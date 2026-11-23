/**
 * Firebase Cloud Functions entrypoint.
 *
 * The Express app remains the single HTTP application for local development,
 * tests, and Firebase. Cloud Functions owns the listener and invokes this
 * handler for every request, so this module must never call `listen()`.
 */
import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onInit } from "firebase-functions/v2/core";

import type { createApp } from "./app.js";

/**
 * London, next to the database (Supabase, Ireland) and most shoppers. Changing it moves the function: its address
 * changes, so the storefront API address and the Stripe webhook addresses must change in the same release
 * (docs/launch/hosting-move-checklist.md).
 */
const API_REGION = process.env.FUNCTIONS_REGION ?? "europe-west2";

let application: ReturnType<typeof createApp>;
let initialization: Promise<void> | undefined;

// Firebase discovers exports before it loads the project-specific environment.
// Load runtime dependencies and validate credentials only when an instance starts.
// Cache the promise so concurrent cold-start requests share one application.
onInit(() => {
  initialization ??= (async () => {
    const { loadConfig } = await import("./config.js");
    const config = loadConfig({
      ...process.env,
      // The Windows emulator uses a named pipe, not a numeric HTTP port.
      PORT: undefined,
      TRUST_PROXY: process.env.TRUST_PROXY ?? "true",
      // A deployed instance must never accept development authentication.
      NODE_ENV: process.env.FUNCTIONS_EMULATOR === "true"
        ? process.env.NODE_ENV ?? "development"
        : "production",
    });
    const { createApp } = await import("./app.js");
    application = createApp({ config });
  })();
  return initialization;
});

export const api = onRequest(
  {
    region: API_REGION,
    timeoutSeconds: 60,
    memory: "1GiB",
    // Store pages are served from the storefront cache, so most traffic never reaches here; raised from 5 so a
    // busy hour does not queue checkouts. Keep a budget alert on the Google Cloud project.
    maxInstances: 20,
  },
  (request, response) => {
    // Cloud Functions has already consumed the request stream and keeps the
    // bytes on `rawBody`. Multer reads the stream, so replay the buffer for
    // multipart uploads or they fail with "Unexpected end of form".
    const { rawBody } = request as typeof request & { rawBody?: Buffer };
    if (rawBody && request.headers["content-type"]?.startsWith("multipart/form-data")) {
      request.pipe = ((destination: NodeJS.WritableStream) => {
        destination.end(rawBody);
        return destination;
      }) as typeof request.pipe;
    }
    application(request, response);
  },
);

export const orderWorkers = onSchedule({ schedule: "every 1 minutes", region: API_REGION, timeoutSeconds: 300, memory: "1GiB", maxInstances: 1 }, async () => {
  if (application.locals.runOrderWorkers) {
    const result = await application.locals.runOrderWorkers();
    console.info("Order workers completed", result);
  }
});
