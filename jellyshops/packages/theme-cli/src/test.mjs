import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadProject } from "./project.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

/** Runs the conformance suite against a theme folder: registers it, then renders and checks every template. */
export async function test(folder) {
  let project;
  try { project = loadProject(folder); } catch (error) { process.stderr.write(`${error.message}\n`); return 2; }
  const vitestPackage = require.resolve("vitest/package.json");
  const vitest = join(dirname(vitestPackage), "vitest.mjs");
  const child = spawn(process.execPath, [vitest, "run", "--config", join(root, "vitest.theme.config.ts"), "--root", root], {
    stdio: "inherit",
    env: { ...process.env, JELLY_THEME_DIR: project.directory },
  });
  return new Promise((resolve) => child.on("exit", (code) => resolve(code ?? 1)));
}
