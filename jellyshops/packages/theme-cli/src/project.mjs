import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

/** Reads a theme folder: theme.json (required), starter.json and theme.css (optional). */
export function loadProject(folder) {
  const directory = resolve(process.cwd(), folder);
  const read = (name, required) => {
    const file = join(directory, name);
    if (!existsSync(file)) {
      if (required) throw new Error(`${name} was not found in ${directory}. Run this command inside a theme folder, or pass the folder.`);
      return undefined;
    }
    try { return JSON.parse(readFileSync(file, "utf8")); }
    catch (error) { throw new Error(`${name} is not valid JSON: ${error.message}`); }
  };
  const manifest = read("theme.json", true);
  const starter = read("starter.json", false);
  const cssFile = join(directory, "theme.css");
  const css = existsSync(cssFile) ? readFileSync(cssFile, "utf8") : "";
  const prefix = `/themes/${manifest?.id}/`;
  /** True when the file a manifest path names exists under the theme's assets/ folder. */
  const assetExists = (path) => existsSync(join(directory, "assets", path.startsWith(prefix) ? path.slice(prefix.length) : path.replace(/^\/+/, "")));
  return { directory, manifest, starter, css, assetExists };
}
