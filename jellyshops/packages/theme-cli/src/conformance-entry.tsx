import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describeThemeConformance } from "@jelly/theme-sdk/testing";
import { registerThemeProject } from "@jelly/storefront-themes";

// The folder under test comes from the CLI (JELLY_THEME_DIR).
const directory = process.env.JELLY_THEME_DIR ?? "";
const read = (name: string) => JSON.parse(readFileSync(join(directory, name), "utf8"));
const manifest = read("theme.json");
const starter = existsSync(join(directory, "starter.json")) ? read("starter.json") : undefined;
if (!registerThemeProject({ manifest, starter })) throw new Error("This theme has no starter.json, so there is nothing to render. Add one (see the template).");
describeThemeConformance(manifest.id);
