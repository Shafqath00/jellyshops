import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { validateThemeProject } from "@jelly/storefront-themes";
import { loadProject } from "./project.mjs";

const CONTENT_TYPES = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif",
  ".svg": "image/svg+xml", ".woff2": "font/woff2",
};
/** The whole package is sent in one request, which the server limits to 8 MB. */
const MAX_PACKAGE_BYTES = 7_500_000;

function* files(directory) {
  for (const entry of readdirSync(directory).sort()) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) yield* files(path); else yield path;
  }
}

/**
 * Reads a theme folder into the package the platform accepts: theme.json, starter.json, the
 * stylesheet (as written; the platform scopes it) and every file in assets/. Throws with a plain
 * message when the theme does not pass `validate` or holds a file type that is not allowed.
 */
export function buildPackage(folder) {
  const project = loadProject(folder);
  const issues = validateThemeProject({ manifest: project.manifest, starter: project.starter, assetExists: project.assetExists, css: project.css });
  const errors = issues.filter((issue) => issue.level === "error");
  if (errors.length) throw new Error(`The theme has ${errors.length} error${errors.length === 1 ? "" : "s"}. Run \`jelly-theme validate\` and fix them first:\n${errors.slice(0, 5).map((issue) => `  ${issue.path}: ${issue.message}`).join("\n")}`);

  const assets = [];
  const assetDirectory = join(project.directory, "assets");
  if (existsSync(assetDirectory)) {
    for (const file of files(assetDirectory)) {
      const contentType = CONTENT_TYPES[extname(file).toLowerCase()];
      const path = relative(assetDirectory, file).replaceAll("\\", "/");
      if (!contentType) throw new Error(`assets/${path}: ${extname(file) || "this"} files are not allowed. Use png, jpg, webp, gif, svg or woff2.`);
      assets.push({ path, contentType, base64: readFileSync(file).toString("base64") });
    }
  }
  const content = { format: 1, manifest: project.manifest, ...(project.starter ? { starter: project.starter } : {}), css: project.css, assets };
  const size = Buffer.byteLength(JSON.stringify(content));
  if (size > MAX_PACKAGE_BYTES) throw new Error(`The package is ${(size / 1_000_000).toFixed(1)} MB; the limit is ${(MAX_PACKAGE_BYTES / 1_000_000).toFixed(1)} MB. Shrink the images.`);
  return { name: `${project.manifest.id}-${project.manifest.version}.jellytheme.json`, content, size, warnings: issues.filter((issue) => issue.level === "warning") };
}

/** `jelly-theme package [folder] [--out dir]`: writes <id>-<version>.jellytheme.json (default folder: dist/). */
export async function pack(folder, flags = {}) {
  let built;
  try { built = buildPackage(folder); } catch (error) { process.stderr.write(`${error.message}\n`); return 1; }
  const directory = resolve(process.cwd(), typeof flags.out === "string" ? flags.out : join(folder, "dist"));
  mkdirSync(directory, { recursive: true });
  const file = join(directory, built.name);
  writeFileSync(file, JSON.stringify(built.content));
  for (const warning of built.warnings) process.stdout.write(`warning ${warning.path}: ${warning.message}\n`);
  process.stdout.write(`Wrote ${file} (${(built.size / 1000).toFixed(0)} KB, ${built.content.assets.length} file${built.content.assets.length === 1 ? "" : "s"})\n`);
  return 0;
}
