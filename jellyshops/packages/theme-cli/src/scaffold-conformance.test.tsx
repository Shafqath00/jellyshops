import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { vi } from "vitest";
import { registerThemeProject } from "@jelly/storefront-themes";
import { describeThemeConformance } from "@jelly/theme-sdk/testing";
// @ts-expect-error plain JavaScript module
import { create } from "./create.mjs";

// A freshly created theme must pass the same suite as the built-in themes, so the template can not rot.
const directory = mkdtempSync(join(tmpdir(), "jelly-scaffold-"));
const original = process.cwd();
process.chdir(directory);
vi.spyOn(process.stdout, "write").mockImplementation(() => true);
await create("fresh-theme");
process.chdir(original);
const read = (name: string) => JSON.parse(readFileSync(join(directory, "fresh-theme", name), "utf8"));
registerThemeProject({ manifest: read("theme.json"), starter: read("starter.json") });
vi.restoreAllMocks();

describeThemeConformance("fresh-theme");
