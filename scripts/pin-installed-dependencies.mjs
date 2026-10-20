import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url));
for (const directory of ["jellyshops", "backend"]) {
  const file = path.join(root, directory, "package.json");
  const manifest = JSON.parse(readFileSync(file, "utf8"));
  const lockPath = path.join(root, directory, "package-lock.json");
  const lock = JSON.parse(readFileSync(lockPath, "utf8"));
  for (const group of ["dependencies", "devDependencies"]) {
    for (const [name, range] of Object.entries(manifest[group] ?? {})) {
      if (String(range).startsWith("file:") || name.startsWith("@jelly/")) continue;
      const version = lock.packages[`node_modules/${name}`]?.version;
      if (!version) throw new Error(`Missing locked version for ${name}`);
      manifest[group][name] = version;
    }
  }
  writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
}
// Regenerate lockfiles with npm after this script; never hand-edit integrity data.
