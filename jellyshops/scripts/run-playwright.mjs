import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const env = { ...process.env };
delete env.NO_COLOR;
env.NEXT_PUBLIC_STORE_EDITOR_API_URL = "http://127.0.0.1:3001";
const backendDirectory = [resolve(process.cwd(), "../backend"), resolve(process.cwd(), "../../../backend")]
  .find((candidate) => existsSync(join(candidate, "package.json")));
if (!backendDirectory) throw new Error("Could not locate the sibling backend project");
const backendCli = join(backendDirectory, "node_modules", "tsx", "dist", "cli.mjs");
const temporaryRoot = mkdtempSync(join(tmpdir(), "jelly-store-editor-e2e-"));
const backend = spawn(process.execPath, [backendCli, "src/server.ts"], {
  cwd: backendDirectory,
  env: {
    ...env,
    NODE_ENV: "test",
    PORT: "3001",
    CORS_ORIGINS: "http://127.0.0.1:3000",
    DATA_DIRECTORY: join(temporaryRoot, "data"),
    UPLOAD_DIRECTORY: join(temporaryRoot, "uploads"),
    JELLY_E2E: "1",
  },
  stdio: "inherit",
});

const terminateTree = (pid) => {
  if (!pid) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore" });
  else process.kill(-pid, "SIGTERM");
};

const waitForBackend = async () => {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch("http://127.0.0.1:3001/health");
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("Store Editor API did not become ready on port 3001");
};

const cli = fileURLToPath(new URL("../node_modules/@playwright/test/cli.js", import.meta.url));
let child;
try {
  await waitForBackend();
  child = spawn(process.execPath, [cli, "test", ...process.argv.slice(2)], { env, stdio: "inherit" });
  process.exitCode = await new Promise((resolve) => child.on("exit", (code) => resolve(code ?? 1)));
} finally {
  terminateTree(child?.pid);
  terminateTree(backend.pid);
  rmSync(temporaryRoot, { recursive: true, force: true });
}
