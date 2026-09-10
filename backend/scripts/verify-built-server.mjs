import { once } from "node:events";
import { createServer } from "node:net";
import { spawn } from "node:child_process";

const reservation = createServer();
reservation.listen(0, "127.0.0.1");
await once(reservation, "listening");
const address = reservation.address();
if (!address || typeof address === "string") throw new Error("Unable to reserve a test port");
const port = address.port;
await new Promise((resolve, reject) => reservation.close((error) => error ? reject(error) : resolve()));

const child = spawn(process.execPath, ["index.js"], {
  cwd: new URL("..", import.meta.url),
  env: {
    ...process.env,
    NODE_ENV: "test",
    PORT: String(port),
    AUTH_PROVIDER: "development",
    REPOSITORY_PROVIDER: "local-json",
    MEDIA_PROVIDER: "local-files",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let output = "";
child.stdout.setEncoding("utf8");
child.stderr.setEncoding("utf8");
child.stdout.on("data", (chunk) => { output += chunk; });
child.stderr.on("data", (chunk) => { output += chunk; });

const deadline = Date.now() + 10_000;
try {
  while (!output.includes("Server running") && child.exitCode === null && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  if (!output.includes("Server running")) {
    throw new Error(`Built server failed to start:\n${output.trim()}`);
  }

  const response = await fetch(`http://127.0.0.1:${port}/health`);
  const body = await response.json();
  if (!response.ok || body.ok !== true) {
    throw new Error(`Health check failed with ${response.status}`);
  }
  console.log("Built server startup and health check passed.");
} finally {
  if (child.exitCode === null) child.kill("SIGTERM");
  await Promise.race([
    once(child, "exit"),
    new Promise((resolve) => setTimeout(resolve, 2_000)),
  ]);
}
