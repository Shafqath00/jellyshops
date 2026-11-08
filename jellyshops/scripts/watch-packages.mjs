#!/usr/bin/env node
/**
 * Rebuilds the schema, registry and themes packages whenever their source changes.
 *
 *   npm run watch:packages          watch packages only
 *   npm run dev                     watch and run the dev server together
 *   npm run dev -- -p 3002           pass options to the dev server
 *
 * The renderer and UI packages are used as source, so the dev server already reloads them. Schema,
 * registry and themes are used as built output; this keeps that output fresh. Press Ctrl+C to stop.
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const frontend = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const tsc = require.resolve("typescript/bin/tsc", { paths: [frontend] });
const packages = ["storefront-schema", "storefront-registry", "storefront-themes"];
const children = [];
let stopping = false;

function prefix(name, stream, target) {
  let pending = "";
  stream.on("data", (chunk) => {
    pending += chunk.toString();
    const lines = pending.split(/\r?\n/);
    pending = lines.pop() ?? "";
    for (const line of lines) if (line.trim()) target.write(`[${name}] ${line.replace(/\u001bc/g, "")}\n`);
  });
}

function start(name, command, args, cwd) {
  const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"], shell: false });
  prefix(name, child.stdout, process.stdout);
  prefix(name, child.stderr, process.stderr);
  child.on("exit", (code) => { if (!stopping) { console.error(`[${name}] stopped (exit ${code})`); stop(code ?? 1); } });
  children.push(child);
}

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  setTimeout(() => process.exit(code), 200);
}
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));

// An initial full build first, in dependency order, so the watchers start from a consistent state.
for (const name of packages) {
  await new Promise((done, fail) => {
    const build = spawn(process.execPath, [tsc, "-p", "tsconfig.build.json"], { cwd: join(frontend, "packages", name), stdio: "inherit" });
    build.on("exit", (code) => code === 0 ? done() : fail(new Error(`${name} failed to build (exit ${code})`)));
  }).catch((error) => { console.error(error.message); process.exit(1); });
}
console.log("Packages built. Watching for changes…");

for (const name of packages) {
  start(name, process.execPath, [tsc, "-p", "tsconfig.build.json", "--watch", "--preserveWatchOutput"], join(frontend, "packages", name));
}
if (process.argv.includes("--dev")) {
  const next = require.resolve("next/dist/bin/next", { paths: [frontend] });
  const nextArgs = process.argv.slice(process.argv.indexOf("--dev") + 1);
  start("next", process.execPath, [next, "dev", "--turbopack", ...nextArgs], frontend);
}
