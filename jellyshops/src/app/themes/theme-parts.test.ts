import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { THEME_PARTS, themeCssInternals } from "@jelly/storefront-themes";

const root = path.join(__dirname, "..", "..", "..");
const baselinePath = path.join(__dirname, "theme-css-internals.baseline.json");
const baseline = JSON.parse(readFileSync(baselinePath, "utf8")) as Record<string, string[]>;

/** Theme stylesheets checked: every folder theme's source CSS (and legacy.css), the built-in themes and the shared kits. */
function stylesheets(): Record<string, string> {
  const themes = path.join(root, "packages/storefront-themes/src/themes");
  const files: Record<string, string> = {};
  for (const id of readdirSync(themes)) {
    for (const name of ["theme.css", "legacy.css"]) {
      const file = path.join(themes, id, name);
      try { if (statSync(file).isFile()) files[`themes/${id}/${name}`] = readFileSync(file, "utf8"); } catch { /* no such file */ }
    }
  }
  for (const name of ["jelly-minimal.css", "jelly-avenue.css", "theme-kit.css", "theme-kit-late.css"]) files[`app/${name}`] = readFileSync(path.join(__dirname, name), "utf8");
  return files;
}

function sourceText(dir: string): string {
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
    .map((file) => readFileSync(path.join(dir, file), "utf8")).join("\n");
}

describe("Named parts (theme CSS may style only these, plus tokens)", () => {
  it("keeps every named part in the storefront markup", () => {
    const markup = ["packages/storefront-renderer/src", "packages/storefront-ui/src", "src/features", "src/app"].map((dir) => sourceText(path.join(root, dir))).join("\n");
    const missing = [...THEME_PARTS].filter((name) => !new RegExp(`(?<![\w-])${name}(?![\w-])`).test(markup));
    expect(missing, "Named parts no longer drawn by the renderer: themes styling them would silently break").toEqual([]);
  });

  it("lets new themes (the CLI scaffold) use named parts only", () => {
    const scaffold = readFileSync(path.join(root, "packages/theme-cli/template/theme.css"), "utf8");
    expect(themeCssInternals(scaffold)).toEqual([]);
  });

  it("never lets a theme start styling another renderer internal", () => {
    const current = Object.fromEntries(Object.entries(stylesheets()).map(([file, css]) => [file, themeCssInternals(css)]));
    if (process.env.JELLY_PARTS_UPDATE === "1") writeFileSync(baselinePath, `${JSON.stringify(current, null, 2)}\n`);
    for (const [file, internals] of Object.entries(current)) {
      const allowed = new Set(baseline[file] ?? []);
      expect(internals.filter((name) => !allowed.has(name)), `${file} styles renderer internals: use a named part, a token or a section setting (or add the part to theme-parts.ts)`).toEqual([]);
    }
  });

  it("keeps the baseline tight: classes a theme no longer uses come off it", () => {
    const current = stylesheets();
    for (const [file, allowed] of Object.entries(baseline)) {
      const used = new Set(current[file] ? themeCssInternals(current[file]) : []);
      expect(allowed.filter((name) => !used.has(name)), `${file}: remove these from theme-css-internals.baseline.json (JELLY_PARTS_UPDATE=1)`).toEqual([]);
    }
  });
});
