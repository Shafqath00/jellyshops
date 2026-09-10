import { createApp } from "./app.js";
import { loadConfig } from "./config.js";

const config = loadConfig();
const server = createApp({ config }).listen(config.port, () => {
 console.log(`Server running on http://localhost:${config.port}`);
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
