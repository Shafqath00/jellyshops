// @vitest-environment node
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { getStarterPack, isCompleteStorefrontTheme, legacyStylesAttribute, listThemes, PLATFORM_SETTING_IDS, themeCssInternals } from "@jelly/storefront-themes";

/**
 * Theme foundation scorecard (docs/plans/theme-foundation-plan.md, phase 0): how far each complete theme is from
 * being built the one platform way. Every later phase moves these numbers; this test fails if any theme gets worse,
 * and rewrites the report and baseline with JELLY_SCORECARD_UPDATE=1 (only after a real improvement).
 *
 *   docs/reports/theme-scorecard.md          the readable report (generated)
 *   src/app/themes/theme-scorecard.json      the baseline the test compares with (generated)
 */
const app = path.join(__dirname, "..", "..", "..");
const repo = path.join(app, "..");
const themesSource = path.join(app, "packages/storefront-themes/src/themes");
const baselinePath = path.join(__dirname, "theme-scorecard.json");
const reportPath = path.join(repo, "docs/reports/theme-scorecard.md");

/**
 * The main section each page type is drawn by (Shopify's main-* sections): the one section that makes the page work,
 * which cannot be deleted. A product page must use Main product (photos and buying parts in one section, not separate
 * sections the theme's CSS lines up); the other page types already have theirs.
 */
export const MAIN_SECTIONS: Record<string, string> = {
  product: "main-product", collection: "collection-product-grid", search: "search-results", cart: "cart-summary",
  page: "page-content", blog: "article-list", article: "article-content", "not-found": "not-found-message",
};

/** Stylesheets that draw a theme: its own file(s), plus the shared kits for the two themes still built on them. */
function stylesheetsOf(id: string, styleId: string): Record<string, string> {
  const files: Record<string, string> = {};
  const folder = path.join(themesSource, id, "theme.css");
  if (existsSync(folder)) files[`themes/${id}/theme.css`] = readFileSync(folder, "utf8");
  const builtIn = { "jelly-signature": "jelly-minimal.css", "jelly-avenue": "jelly-avenue.css" }[styleId];
  if (builtIn) {
    files[`app/${builtIn}`] = readFileSync(path.join(__dirname, builtIn), "utf8");
    for (const kit of ["theme-kit.css", "theme-kit-late.css"]) files[`app/${kit}`] = readFileSync(path.join(__dirname, kit), "utf8");
  }
  return files;
}

const conformanceSource = [path.join(app, "packages/theme-sdk/src"), path.join(app, "packages/storefront-themes/src")]
  .flatMap((dir) => readdirSync(dir).filter((name) => /conformance\.test\.tsx$/.test(name)).map((name) => readFileSync(path.join(dir, name), "utf8"))).join("\n");
const lintBaseline = (JSON.parse(readFileSync(path.join(app, "e2e/design-lint.baseline.json"), "utf8")) as { findings: string[] }).findings;

interface Score {
  theme: string;
  styling: "platform" | "own" | "legacy";
  internals: number;
  settingsCopy: number;
  mainSections: string[];
  pageTypes: string[];
  sectionGroups: boolean;
  demoContent: boolean;
  conformance: boolean;
  lintFindings: number;
  cssGzipKb: number;
}

function score(id: string): Score {
  const theme = listThemes().find((entry) => entry.id === id)!;
  const manifest = theme.manifest as { extends?: string; settingsSchema?: unknown[] };
  const styleId = manifest.extends ?? id;
  const css = stylesheetsOf(id, styleId);
  const attribute = legacyStylesAttribute(id);
  const pack = getStarterPack(id);
  const pageTypes = [...new Set(pack.templates.map((template) => template.type).filter((type) => type in MAIN_SECTIONS))].sort();
  const mainSections = pageTypes.filter((type) => pack.templates.some((template) => template.type === type
    && template.layout.sections.some((placement) => placement.kind === "inline" && placement.section.type === MAIN_SECTIONS[type])));
  const conformance = id === "jelly-signature" || id === "jelly-avenue"
    ? /COMPLETE_STOREFRONT_THEME_IDS/.test(conformanceSource)
    : new RegExp(`describeThemeConformance\\(\\s*['"]${id}['"]`).test(conformanceSource) || (Boolean(manifest.extends) && /extends/.test(conformanceSource));
  return {
    theme: id,
    styling: attribute === "off" ? "platform" : attribute === "own" ? "own" : "legacy",
    internals: new Set(Object.values(css).flatMap((text) => themeCssInternals(text))).size,
    settingsCopy: settingsCopies(id, styleId),
    mainSections,
    pageTypes,
    // Header and footer as section groups (announcement + header, newsletter + footer): not built yet (phase 2).
    sectionGroups: false,
    demoContent: existsSync(path.join(themesSource, id, "demo-content.json")),
    conformance,
    lintFindings: lintBaseline.filter((finding) => finding.split("|")[1] === (id === "jelly-signature" ? "jelly-minimal" : id)).length,
    cssGzipKb: Math.round(gzipSync(Object.values(css).join("\n")).length / 102.4) / 10,
  };
}

/**
 * Platform settings a theme's source copies instead of taking from the platform list (platform-settings.ts): entries
 * in its theme.json `settingsSchema` with a platform id and their own default (a wording change states no default; the
 * value belongs in settingsDefaults), or, for the two built-in definitions, a schema not built with
 * platformSettingsSchema. A theme's own extra settings and wording changes are not copies.
 */
function settingsCopies(id: string, styleId: string): number {
  const builtIn = { "jelly-signature": "jelly-signature", "jelly-avenue": "jelly-avenue" }[id];
  if (builtIn) {
    const source = readFileSync(path.join(app, `packages/storefront-themes/src/${builtIn}/definition.ts`), "utf8");
    return /platformSettingsSchema\(/.test(source) ? 0 : (listThemes().find((theme) => theme.id === id)!.manifest as { settingsSchema?: unknown[] }).settingsSchema?.length ?? 0;
  }
  const file = path.join(themesSource, id, "theme.json");
  if (!existsSync(file)) return styleId === id ? 0 : settingsCopies(styleId, styleId);
  const own = (JSON.parse(readFileSync(file, "utf8")) as { settingsSchema?: Array<{ id: string; default?: unknown }> }).settingsSchema ?? [];
  return own.filter((setting) => PLATFORM_SETTING_IDS.includes(setting.id) && "default" in setting).length;
}

/** Pass/fail checks, in plan order. */
const CHECKS: Array<{ name: string; pass: (s: Score) => boolean }> = [
  { name: "Platform styling", pass: (s) => s.styling === "platform" },
  { name: "No renderer internals", pass: (s) => s.internals === 0 },
  { name: "Platform settings schema", pass: (s) => s.settingsCopy === 0 },
  { name: "Main sections on every page", pass: (s) => s.mainSections.length === s.pageTypes.length },
  { name: "Header and footer groups", pass: (s) => s.sectionGroups },
  { name: "Demo content", pass: (s) => s.demoContent },
  { name: "Conformance suite", pass: (s) => s.conformance },
  { name: "No known lint findings", pass: (s) => s.lintFindings === 0 },
];

const themes = listThemes().filter((theme) => isCompleteStorefrontTheme(theme.id)).map((theme) => theme.id).sort();
const scores = themes.map(score);

function report(): string {
  const yes = (value: boolean) => (value ? "yes" : "**no**");
  const rows = scores.map((s) => `| ${s.theme} | ${CHECKS.filter((check) => check.pass(s)).length}/${CHECKS.length} | ${s.styling} | ${s.internals} | ${s.settingsCopy || "platform"} | ${s.mainSections.length}/${s.pageTypes.length} | ${yes(s.sectionGroups)} | ${yes(s.demoContent)} | ${yes(s.conformance)} | ${s.lintFindings} | ${s.cssGzipKb} |`);
  return [
    "# Theme foundation scorecard",
    "",
    "Generated by `src/app/themes/theme-scorecard.test.ts` (run with `JELLY_SCORECARD_UPDATE=1` after an improvement). Plan: `docs/plans/theme-foundation-plan.md`. Target: every column passes for every theme.",
    "",
    "| Theme | Checks | Styling | Internals styled | Settings schema | Main sections | Header/footer groups | Demo content | Conformance | Lint findings | Theme CSS (KB gz) |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...rows,
    "",
    "Columns: **Styling** platform = the shared platform base design, own = the theme brings all its CSS, legacy = the old global storefront rules. **Internals styled**: renderer class names the theme's CSS styles directly (should be named parts or tokens). **Settings schema**: number of settings the theme carries its own copy of (platform = none). **Main sections**: page types drawn by a main section (main-product, main-collection, ...) out of the page types its starter has. **Lint findings**: known findings in the design lint baseline. **Theme CSS** includes the shared kit for themes built on it.",
    "",
  ].join("\n");
}

describe("Theme foundation scorecard", () => {
  it("lists every complete theme", () => {
    expect(themes).toEqual(expect.arrayContaining(["jelly-signature", "jelly-avenue", "jelly-resthaven", "jelly-forma", "jelly-halo", "jelly-diode", "jelly-harbour"]));
  });

  it("never gets worse for any theme (JELLY_SCORECARD_UPDATE=1 records an improvement)", () => {
    if (process.env.JELLY_SCORECARD_UPDATE === "1") {
      writeFileSync(baselinePath, `${JSON.stringify(Object.fromEntries(scores.map((s) => [s.theme, s])), null, 2)}\n`);
      writeFileSync(reportPath, report());
    }
    const baseline = JSON.parse(readFileSync(baselinePath, "utf8")) as Record<string, Score>;
    for (const s of scores) {
      const before = baseline[s.theme];
      expect(before, `${s.theme} is new: record it with JELLY_SCORECARD_UPDATE=1`).toBeDefined();
      for (const check of CHECKS) if (check.pass(before)) expect(check.pass(s), `${s.theme}: "${check.name}" passed before and fails now`).toBe(true);
      expect(s.internals, `${s.theme}: styles more renderer internals than before`).toBeLessThanOrEqual(before.internals);
      expect(s.mainSections.length, `${s.theme}: fewer page types use main sections than before`).toBeGreaterThanOrEqual(before.mainSections.length);
      expect(s.lintFindings, `${s.theme}: more known lint findings than before`).toBeLessThanOrEqual(before.lintFindings);
    }
  });

  it("keeps the report in step with the scores", () => {
    expect(readFileSync(reportPath, "utf8"), "run the scorecard with JELLY_SCORECARD_UPDATE=1").toBe(report());
  });
});
