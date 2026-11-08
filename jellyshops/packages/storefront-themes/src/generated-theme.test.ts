import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { getStarterPack, validateStarterPack } from "./starter-packs";
import { themeManifestSchema } from "./theme-manifest-schema";
import { getThemeDefinition, isCompleteStorefrontTheme, themeStyleId } from "./theme-registry";
import { resolveTheme, validateThemeSettings } from "./theme-resolver";
import { resolveStorefrontThemeTokens } from "./storefront-theme-tokens";

const repo = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const folder = join(repo, "jellyshops/packages/storefront-themes/src/themes/jelly-harbour");
const runGenerator = (brief: string, ...extra: string[]) => spawnSync(process.execPath, [join(repo, "scripts/new-theme.mjs"), brief, ...extra], { encoding: "utf8" });

describe("themes built on a base design (extends)", () => {
  it("reuse the base design's settings and stylesheets with their own values", () => {
    const harbour = getThemeDefinition("jelly-harbour");
    expect(harbour.label).toBe("Harbour");
    expect(themeStyleId("jelly-harbour")).toBe("jelly-signature");
    expect(themeStyleId("jelly-signature")).toBe("jelly-signature");
    expect(themeStyleId("jelly-resthaven")).toBe("jelly-resthaven");
    expect(themeStyleId("not-a-theme")).toBe("not-a-theme");
    expect(isCompleteStorefrontTheme("jelly-harbour")).toBe(true);
    const schema = (harbour.manifest as { settingsSchema: Array<{ id: string; default?: unknown }> }).settingsSchema;
    const minimal = (getThemeDefinition("jelly-signature").manifest as { settingsSchema: Array<{ id: string }> }).settingsSchema;
    expect(schema.map((setting) => setting.id)).toEqual(minimal.map((setting) => setting.id));
    expect(schema.find((setting) => setting.id === "colors.primary")?.default).toBe("#1e4d5c");
    expect(schema.find((setting) => setting.id === "typography.headingFont")?.default).toBe("DM Serif Display");
    const theme = resolveTheme("jelly-harbour");
    expect(validateThemeSettings("jelly-harbour", theme.settings)).toEqual([]);
    const tokens = resolveStorefrontThemeTokens(theme.id, theme.settings);
    expect(tokens["--theme-background"]).toBe("#f5f7f6");
    expect(tokens["--jelly-scheme-dark-bg"]).toBe("var(--jelly-scheme-4-bg)");
    expect(tokens["--jelly-scheme-4-bg"]).toBe("#17323b");
    expect(validateStarterPack(getStarterPack("jelly-harbour"))).toEqual([]);
  });

  it("may only extend a built-in design, never itself", () => {
    const base = JSON.parse(readFileSync(join(folder, "theme.json"), "utf8"));
    expect(themeManifestSchema.safeParse(base).success).toBe(true);
    expect(themeManifestSchema.safeParse({ ...base, extends: "jelly-resthaven" }).success).toBe(false);
    expect(themeManifestSchema.safeParse({ ...base, id: "jelly-signature", assetPrefix: "/themes/jelly-signature/", extends: "jelly-signature" }).success).toBe(false);
  });
});

describe("scripts/new-theme.mjs", () => {
  it("reproduces the committed Harbour theme from its brief (data only, no CSS)", () => {
    const result = runGenerator(join(repo, "docs/theme-briefs/jelly-harbour.json"), "--print");
    expect(result.status, result.stderr).toBe(0);
    const { manifest, starter } = JSON.parse(result.stdout);
    expect(manifest).toEqual(JSON.parse(readFileSync(join(folder, "theme.json"), "utf8")));
    expect(starter).toEqual(JSON.parse(readFileSync(join(folder, "starter.json"), "utf8")));
  });

  it("refuses a brief whose colours would be hard to read", () => {
    const brief = JSON.parse(readFileSync(join(repo, "docs/theme-briefs/jelly-harbour.json"), "utf8"));
    const path = join(mkdtempSync(join(tmpdir(), "jelly-brief-")), "brief.json");
    writeFileSync(path, JSON.stringify({ ...brief, colors: { ...brief.colors, secondary: "#b8c2c6" } }));
    const result = runGenerator(path, "--print");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("colors.secondary on colors.background");
  });
});
