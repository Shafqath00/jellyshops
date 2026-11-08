import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { registerThemeProject } from "@jelly/storefront-themes";
import { describeThemeConformance } from "./testing";

// The theme in docs/examples/jelly-studio is the one the developer guide builds, and it goes through
// the same suite as a theme a developer would write, so the guide cannot teach something that fails.
const directory = [resolve(process.cwd(), "../docs/examples/jelly-studio"), resolve(process.cwd(), "docs/examples/jelly-studio")].find((path) => existsSync(path)) ?? "";
const read = (name: string) => JSON.parse(readFileSync(resolve(directory, name), "utf8"));
registerThemeProject({ manifest: read("theme.json"), starter: read("starter.json") });

describeThemeConformance("jelly-studio");
