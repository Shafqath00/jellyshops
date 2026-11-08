import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const frontendDirectory = process.cwd();
const backendDirectory = [resolve(frontendDirectory, "../backend"), resolve(frontendDirectory, "../../../backend")]
  .find((candidate) => existsSync(join(candidate, "package.json")));
if (!backendDirectory) throw new Error("Could not locate the sibling backend project.");
const localConfig = parseEnv(readFileSync(resolve(frontendDirectory, ".env.onboarding.local"), "utf8"));
for (const key of ["JELLY_ONBOARDING_E2E_PROJECT_REF", "JELLY_ONBOARDING_E2E_EMAIL", "JELLY_ONBOARDING_E2E_PASSWORD"]) {
  if (!localConfig[key]) throw new Error("Run npm run provision:onboarding-e2e from backend before the onboarding browser gate.");
}

const env = { ...process.env, ...localConfig };
const frontendPort = env.JELLY_E2E_FRONTEND_PORT ?? "3100";
const backendPort = env.JELLY_E2E_BACKEND_PORT ?? "3101";
env.JELLY_E2E_FRONTEND_PORT = frontendPort;
env.JELLY_E2E_BACKEND_PORT = backendPort;
env.JELLY_ONBOARDING_E2E_API_URL = `http://127.0.0.1:${backendPort}`;
env.NEXT_PUBLIC_STORE_EDITOR_API_URL = `http://127.0.0.1:${backendPort}`;
delete env.NO_COLOR;

const backendCli = join(backendDirectory, "node_modules", "tsx", "dist", "cli.mjs");
const temporaryRoot = mkdtempSync(join(tmpdir(), "jelly-onboarding-e2e-"));
let backend;
let child;
let exitCode = 1;

function stopTree(pid) {
  if (!pid) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore" });
  else process.kill(-pid, "SIGTERM");
}

function runNode(cwd, args) {
  return new Promise((resolve, reject) => {
    child = spawn(process.execPath, args, { cwd, env, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
}

async function waitForBackend() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`http://127.0.0.1:${backendPort}/health`)).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("Local Store Editor API did not become ready for the onboarding reset.");
}

try {
  backend = spawn(process.execPath, [backendCli, "src/server.ts"], {
    cwd: backendDirectory,
    env: {
      ...env,
      NODE_ENV: "test",
      PORT: backendPort,
      CORS_ORIGINS: `http://127.0.0.1:${frontendPort}`,
      DATA_DIRECTORY: join(temporaryRoot, "data"),
      UPLOAD_DIRECTORY: join(temporaryRoot, "uploads"),
      JELLY_E2E: "1",
    },
    stdio: "inherit",
  });
  await waitForBackend();
  const resetCode = await runNode(backendDirectory, [backendCli, "scripts/reset-onboarding-e2e.ts"]);
  if (resetCode !== 0) throw new Error("The dedicated merchant could not be safely reset; Playwright was not started.");

  stopTree(backend.pid);
  backend = undefined;
  exitCode = await runNode(frontendDirectory, ["scripts/run-playwright.mjs", "e2e/onboarding.spec.ts"]);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : "Onboarding E2E setup failed."}\n`);
  exitCode = 1;
} finally {
  stopTree(child?.pid);
  stopTree(backend?.pid);
  rmSync(temporaryRoot, { recursive: true, force: true });
}

process.exitCode = exitCode;

function parseEnv(contents) {
  const values = {};
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const raw = match[2];
    if (raw.startsWith('"')) values[match[1]] = JSON.parse(raw);
    else values[match[1]] = raw.replace(/^'(.*)'$/, "$1").replace(/\s+#.*$/, "").trim();
  }
  return values;
}
