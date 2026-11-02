#!/usr/bin/env node
/**
 * Checks a theme project with the platform's own rules.
 *
 *   node scripts/validate-theme.mjs docs/examples/jelly-studio
 *   node scripts/validate-theme.mjs path/to/theme --json
 *
 * The folder needs `theme.json` (the manifest) and may have `starter.json` (templates and shared
 * sections). Asset files named in the manifest are looked up under `jellyshops/public/themes/<id>/`
 * (where themes keep them today) and in the theme folder's `assets/` folder. Exit code 1 when there are errors.
 * Run `npm run build:storefront-packages` in jellyshops/ first.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const json = args.includes("--json");
const folder = args.find((arg) => !arg.startsWith("--"));

if (!folder) {
  console.error("Usage: node scripts/validate-theme.mjs <theme folder> [--json]");
  process.exit(2);
}

const distribution = join(root, "jellyshops/packages/storefront-themes/dist/index.js");
if (!existsSync(distribution)) {
  console.error("The packages are not built yet. Run `npm run build:storefront-packages` in jellyshops/ first.");
  process.exit(2);
}
const { validateThemeProject } = await import(pathToFileURL(distribution).href);

const themeDirectory = resolve(process.cwd(), folder);
const read = (name, required) => {
  const file = join(themeDirectory, name);
  if (!existsSync(file)) {
    if (required) { console.error(`${name} was not found in ${themeDirectory}.`); process.exit(2); }
    return undefined;
  }
  try { return JSON.parse(readFileSync(file, "utf8")); }
  catch (error) { console.error(`${name} is not valid JSON: ${error.message}`); process.exit(2); }
};

const manifest = read("theme.json", true);
const starter = read("starter.json", false);
// A theme keeps its files under public/themes/<id>/ today; a theme folder keeps them in assets/.
const assetPrefix = `/themes/${manifest?.id}/`;
const assetFound = (path) => existsSync(join(root, "jellyshops/public", path.replace(/^\/+/, "")))
  || existsSync(join(themeDirectory, "assets", path.startsWith(assetPrefix) ? path.slice(assetPrefix.length) : path.replace(/^\/+/, "")));
const issues = validateThemeProject({
  manifest,
  starter,
  assetExists: assetFound,
});

const errors = issues.filter((issue) => issue.level === "error");
const warnings = issues.filter((issue) => issue.level === "warning");

if (json) {
  console.log(JSON.stringify({ theme: manifest?.id ?? null, ok: errors.length === 0, errors, warnings }, null, 2));
} else {
  console.log(`Theme ${manifest?.id ?? "(no id)"} ${manifest?.version ?? ""}${starter ? " with starter" : " (no starter.json)"}`);
  for (const issue of errors) console.log(`  ERROR    ${issue.path}\n           ${issue.message}`);
  for (const issue of warnings) console.log(`  warning  ${issue.path}\n           ${issue.message}`);
  console.log(errors.length ? `\n${errors.length} error${errors.length === 1 ? "" : "s"}, ${warnings.length} warning${warnings.length === 1 ? "" : "s"}. Fix the errors before uploading or publishing.` : `\nNo errors${warnings.length ? `, ${warnings.length} warning${warnings.length === 1 ? "" : "s"}` : ""}.`);
}
process.exit(errors.length ? 1 : 0);
