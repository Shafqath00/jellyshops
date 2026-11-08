import { createApp } from "./app.js";
import { loadConfig } from "./config.js";

const config = loadConfig();
const app = createApp({ config });
const server = app.listen(config.port, () => {
  console.log(`Server running on http://localhost:${config.port}`);
});
let runningWorkers = false;
const workerTimer = setInterval(async () => {
  if (runningWorkers || !app.locals.runOrderWorkers) return;
  runningWorkers = true;
  try { await app.locals.runOrderWorkers(); }
  catch (error) { console.error("Order worker failed", error instanceof Error ? error.message : "unknown error"); }
  finally { runningWorkers = false; }
}, 60_000);
workerTimer.unref();

function shutdown() {
  clearInterval(workerTimer);
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
