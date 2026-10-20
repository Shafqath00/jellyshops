import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const backend = path.join(root, "backend");
const check = process.argv.includes("--check");
function npm(args, cwd) {
  const result = spawnSync("npm", args, { cwd, shell: process.platform === "win32", stdio: "inherit" });
  if (result.status !== 0) throw new Error(`npm ${args.join(" ")} failed`);
}
const hash = (file) => { try { return createHash("sha512").update(readFileSync(file)).digest("base64"); } catch { return null; } };
const manifestPath = path.join(backend, "package.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const lockPath = path.join(backend, "package-lock.json");
const lock = JSON.parse(readFileSync(lockPath, "utf8"));
for (const name of ["storefront-schema", "storefront-registry", "storefront-themes"]) {
  const directory = path.join(root, "jellyshops", "packages", name);
  const pkg = JSON.parse(readFileSync(path.join(directory, "package.json"), "utf8"));
  const filename = `${pkg.name.replace(/^@/, "").replace("/", "-")}-${pkg.version}.tgz`;
  const archive = path.join(backend, filename);
  const previous = hash(archive);
  npm(["run", "build"], directory);
  npm(["pack", "--pack-destination", backend], directory);
  if (check && previous !== hash(archive)) throw new Error(`${filename} differs from shared sources. Run node scripts/prepare-shared-packages.mjs and commit the archives and lockfile.`);
  if (check && manifest.dependencies[pkg.name] !== `file:./${filename}`) throw new Error(`${pkg.name} uses a stale archive path`);
  const entry = lock.packages[`node_modules/${pkg.name}`];
  if (check && entry?.integrity !== `sha512-${hash(archive)}`) throw new Error(`${pkg.name} lockfile integrity does not match its archive`);
  if (!check && entry) entry.integrity = `sha512-${hash(archive)}`;
  manifest.dependencies[pkg.name] = `file:./${filename}`;
  manifest.overrides[pkg.name] = `file:./${filename}`;
}
if (!check) {
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
  npm(["install", "--package-lock-only", "--ignore-scripts"], backend);
}
