#!/usr/bin/env node
/**
 * Writes the machine-readable theme schemas to docs/schemas/ (generated from the platform's own
 * schemas and section registry):
 *
 *   node scripts/generate-schemas.mjs           write the files
 *   node scripts/generate-schemas.mjs --check   fail if the committed files are out of date
 *
 * Run `npm run build:storefront-packages` in jellyshops/ first.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distribution = join(root, "jellyshops/packages/storefront-themes/dist/index.js");
if (!existsSync(distribution)) {
  console.error("The packages are not built yet. Run `npm run build:storefront-packages` in jellyshops/ first.");
  process.exit(2);
}
const { buildSchemaFiles } = await import(pathToFileURL(distribution).href);
const files = buildSchemaFiles();
const directory = join(root, "docs/schemas");
const check = process.argv.includes("--check");
let stale = 0;
for (const [name, content] of Object.entries(files)) {
  const file = join(directory, name);
  if (check) {
    if (!existsSync(file) || readFileSync(file, "utf8") !== content) { console.error(`docs/schemas/${name} is out of date. Run: node scripts/generate-schemas.mjs`); stale++; }
  } else {
    mkdirSync(directory, { recursive: true });
    writeFileSync(file, content);
    console.log(`wrote docs/schemas/${name} (${Math.round(content.length / 1024)} KB)`);
  }
}
process.exit(stale ? 1 : 0);
