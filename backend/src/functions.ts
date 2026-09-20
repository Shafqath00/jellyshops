/**
 * Firebase Cloud Functions entrypoint.
 *
 * The Express app remains the single HTTP application for local development,
 * tests, and Firebase. Cloud Functions owns the listener and invokes this
 * handler for every request, so this module must never call `listen()`.
 */
import { onRequest } from "firebase-functions/v2/https";

import { createApp } from "./app.js";
import { loadConfig } from "./config.js";

// Firebase does not guarantee NODE_ENV. The emulator should remain compatible
// with local development; deployed environments should set NODE_ENV=production
// in their function environment so the existing production validation applies.
const config = loadConfig({
  ...process.env,
  NODE_ENV: process.env.NODE_ENV ?? "development",
});

export const api = onRequest(
  {
    region: process.env.FUNCTIONS_REGION ?? "us-central1",
    timeoutSeconds: 60,
    memory: "1GiB",
  },
  createApp({ config }),
);
