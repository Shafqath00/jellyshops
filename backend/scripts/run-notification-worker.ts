import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { localNotificationWorkerConfig, runLocalNotificationWorker } from "../src/commerce/local-notification-worker.js";

config({ path: fileURLToPath(new URL("../.env", import.meta.url)), quiet: true });
const controller = new AbortController();
process.once("SIGINT", () => controller.abort());
process.once("SIGTERM", () => controller.abort());
try {
  const worker = localNotificationWorkerConfig(process.env);
  const check = process.argv.includes("--check");
  const once = process.argv.includes("--once");
  console.info(`${check ? "Checking" : "Starting"} local notification worker: ${worker.endpoint}`);
  const result = await runLocalNotificationWorker(worker, {
    check, once, signal: controller.signal,
    onResult: (value) => console.info(JSON.stringify({ time: new Date().toISOString(), result: value })),
    onError: (error) => console.error(error instanceof Error ? error.message : "Notification worker request failed"),
  });
  if (result !== undefined) console.info(JSON.stringify(result));
} catch (error) {
  console.error(error instanceof Error ? error.message : "Notification worker failed");
  process.exitCode = 1;
}
