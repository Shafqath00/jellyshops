import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const templateDirectory = join(dirname(fileURLToPath(import.meta.url)), "..", "template");

function slug(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function title(id) {
  return id.split("-").filter(Boolean).map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
}

/** Copies the template into <name>/, naming the theme after the folder. */
export async function create(name) {
  if (!name) { process.stderr.write("Usage: jelly-theme create <name>\n"); return 2; }
  const id = slug(basename(resolve(process.cwd(), name)));
  if (!/^[a-z][a-z0-9-]*$/.test(id)) { process.stderr.write(`"${name}" cannot be turned into a theme id (letters, numbers and dashes, starting with a letter).\n`); return 2; }
  const target = resolve(process.cwd(), name);
  if (existsSync(target) && readdirSync(target).length) { process.stderr.write(`${target} already exists and is not empty.\n`); return 1; }
  mkdirSync(target, { recursive: true });
  cpSync(templateDirectory, target, { recursive: true });
  const display = title(id);
  const fill = (text) => text.replaceAll("__ID__", id).replaceAll("__NAME__", display);
  for (const file of walk(target)) {
    if (/\.(json|svg|md|css)$/.test(file)) writeFileSync(file, fill(readFileSync(file, "utf8")));
  }
  writeFileSync(join(target, "package.json"), `${JSON.stringify({
    name: id, version: "1.0.0", private: true, type: "module",
    scripts: { dev: "jelly-theme dev", validate: "jelly-theme validate", test: "jelly-theme test", package: "jelly-theme package", upload: "jelly-theme upload" },
    devDependencies: { "@jelly/theme-cli": "^0.1.0" },
  }, null, 2)}\n`);
  writeFileSync(join(target, ".gitignore"), "node_modules/\n.jelly/\n");
  process.stdout.write(`Created ${display} in ${target}\n\nNext:\n  cd ${name}\n  npm run dev        preview it with sample data\n  npm run validate   check it\n`);
  return 0;
}

function* walk(directory) {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) yield* walk(path); else yield path;
  }
}
