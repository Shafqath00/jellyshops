/**
 * Firebase Cloud Functions entrypoint.
 *
 * The Express app remains the single HTTP application for local development,
 * tests, and Firebase. Cloud Functions owns the listener and invokes this
 * handler for every request, so this module must never call `listen()`.
 */
import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";

import { createApp } from "./app.js";
import { loadConfig } from "./config.js";

// Only the explicit Firebase emulator may use development configuration.
// NODE_ENV alone is not evidence that a deployed function is local.
const config = loadConfig({
  ...process.env,
  // Firebase owns the listener. On Windows its emulator sets PORT to a named
  // pipe, so exclude it from the standalone server's numeric port validation.
  // Leave process.env.PORT intact for Firebase's runtime.
  PORT: undefined,
  NODE_ENV: process.env.FUNCTIONS_EMULATOR === "true"
    ? process.env.NODE_ENV ?? "development"
    : "production",
});

const application = createApp({ config });
export const api = onRequest(
  {
    region: process.env.FUNCTIONS_REGION ?? "us-central1",
    timeoutSeconds: 60,
    memory: "1GiB",
    maxInstances: 5,
  },
  application,
);

export const orderWorkers = onSchedule({ schedule: "every 1 minutes", region: process.env.FUNCTIONS_REGION ?? "us-central1", timeoutSeconds: 300, memory: "1GiB", maxInstances: 1 }, async () => {
  if (application.locals.runOrderWorkers) {
    const result = await application.locals.runOrderWorkers();
    console.info("Order workers completed", result);
  }
});
