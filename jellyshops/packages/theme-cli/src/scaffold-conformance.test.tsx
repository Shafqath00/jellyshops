import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import { legacyStylesAttribute, registerThemeProject } from "@jelly/storefront-themes";
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

// A new theme starts from the platform layer: the old default rules in globals.css stay off and the section defaults
// (section-defaults.css, data-jelly-legacy-styles="off") apply.
it("does not inherit the legacy storefront rules", () => { expect(legacyStylesAttribute("fresh-theme")).toBe("off"); });
