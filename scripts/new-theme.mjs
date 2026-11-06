#!/usr/bin/env node
/**
 * Generates a theme from a brief (docs/guides/template-generation-master-prompt.md). The output is data only:
 * `theme.json` (built on Jelly Minimal or Jelly Avenue with `extends`, with the brief's colours, colour schemes,
 * fonts and corners) and `starter.json` (the base design's pages with the brief's copy and pictures). No CSS: the
 * base design's stylesheets and the shared theme kit draw it.
 *
 *   node scripts/new-theme.mjs path/to/brief.json          write jellyshops/packages/storefront-themes/src/themes/<id>/
 *   node scripts/new-theme.mjs path/to/brief.json --print  print the files instead
 *
 * Then: `node scripts/generate-theme-index.mjs`, rebuild the packages, and run the design lint (the gate before review):
 *   cd jellyshops && JELLY_E2E_FRONTEND_PORT=3300 npx playwright test e2e/design-lint.spec.ts
 * Reads the built packages, so run `npm run build:storefront-packages` in jellyshops/ first.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packages = join(root, "jellyshops/packages");
const { getV4StarterPack } = await import(pathToFileURL(join(packages, "storefront-registry/dist/index.js")).href);
const { contrastRatio, starterFileSchema, themeManifestSchema, FONT_OPTIONS, THEME_BASE_IDS } = await import(pathToFileURL(join(packages, "storefront-themes/dist/index.js")).href);

const HEX = /^#[0-9a-fA-F]{6}$/;
const fail = (message) => { console.error(`Brief problem: ${message}`); process.exit(1); };

/** Checks a brief and fills in what it leaves out. */
export function readBrief(brief) {
  if (!brief || typeof brief !== "object") fail("the brief must be a JSON object.");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(brief.id ?? "")) fail("id must be lowercase words joined by hyphens, e.g. jelly-harbour.");
  if (!brief.name) fail("name is required.");
  if (!THEME_BASE_IDS.includes(brief.extends)) fail(`extends must be one of ${THEME_BASE_IDS.join(", ")}.`);
  const colors = brief.colors ?? {};
  for (const key of ["background", "surface", "text", "secondary", "primary", "accent", "dark"]) if (!HEX.test(colors[key] ?? "")) fail(`colors.${key} must be a #rrggbb colour.`);
  const fonts = new Set(FONT_OPTIONS.map((option) => option.value));
  for (const key of ["headingFont", "bodyFont"]) if (!fonts.has(brief.typography?.[key])) fail(`typography.${key} must be one of the platform fonts (${[...fonts].join(", ")}).`);
  const pairs = [["text", "background"], ["secondary", "background"], ["background", "primary"], ["text", "accent"], ["background", "dark"]];
  for (const [fg, bg] of pairs) {
    const ratio = contrastRatio(colors[fg], colors[bg]);
    if (ratio < 4.5) fail(`colors.${fg} on colors.${bg} is ${ratio.toFixed(2)}:1; text needs at least 4.5:1 (WCAG AA).`);
  }
  return brief;
}

/** The four base colour schemes from the palette, with the dark one in the slot the base design uses for it. */
function colorSchemes(colors, base) {
  const dark = { background: colors.dark, text: colors.background, button: colors.background, buttonText: colors.dark };
  const raised = { background: colors.surface, text: colors.text, button: colors.primary, buttonText: colors.surface };
  return {
    scheme1: { name: "", background: colors.background, text: colors.text, button: colors.primary, buttonText: colors.background },
    scheme2: { name: "", background: colors.accent, text: colors.text, button: colors.primary, buttonText: colors.background },
    scheme3: { name: "", ...(base === "jelly-avenue" ? dark : raised) },
    scheme4: { name: "", ...(base === "jelly-avenue" ? raised : dark) },
  };
}

export function themeManifest(brief) {
  const { dark: _dark, ...colors } = brief.colors;
  return {
    id: brief.id,
    extends: brief.extends,
    name: brief.name,
    version: "1.0.0",
    engines: { jelly: ">=1 <2" },
    description: brief.description ?? brief.name,
    assetPrefix: `/themes/${brief.id}/`,
    assets: { stylesheets: [], scripts: [], fonts: [], icons: [], assets: [] },
    layout: brief.extends === "jelly-avenue" ? "editorial" : "standard",
    enabled: true,
    settingsDefaults: {
      colors,
      typography: { headingFont: brief.typography.headingFont, bodyFont: brief.typography.bodyFont },
      ...(brief.buttons?.radius ? { buttons: { radius: brief.buttons.radius } } : {}),
      colorSchemes: colorSchemes(brief.colors, brief.extends),
    },
    settingsSchema: [],
  };
}

/** The base design's starter pages with new ids and the brief's copy and pictures. */
export function starterFile(brief) {
  const pack = getV4StarterPack(brief.extends);
  const rename = (value) => JSON.parse(JSON.stringify(value).replaceAll(`"${brief.extends}-`, `"${brief.id}-`));
  const copy = brief.copy ?? {};
  const globalSections = Object.fromEntries(pack.globalSections.map((entry) => [entry.key, rename(entry.section)]));
  if (copy.announcement && globalSections.announcement) globalSections.announcement.settings = { ...globalSections.announcement.settings, text: copy.announcement };
  if (copy.footer && globalSections.footer) globalSections.footer.settings = { ...globalSections.footer.settings, text: copy.footer };
  const keyOf = Object.fromEntries(pack.globalSections.map((entry) => [entry.section.id, entry.key]));
  const templates = {};
  for (const template of pack.templates) {
    if (templates[template.type]) continue;
    templates[template.type] = {
      type: template.type,
      sections: template.layout.sections.map((placement) => placement.kind === "global"
        ? { kind: "global", globalSectionId: keyOf[placement.globalSectionId] ?? placement.globalSectionId }
        : { kind: "inline", section: rename(placement.section) }),
    };
  }
  const hero = templates.home?.sections.find((placement) => placement.kind === "inline" && ["hero", "slideshow"].includes(placement.section.type))?.section;
  if (hero?.type === "hero") {
    if (copy.heroEyebrow) hero.settings.eyebrow = copy.heroEyebrow;
    if (brief.images?.hero) hero.settings.image = { url: brief.images.hero, alt: brief.images.heroAlt ?? "" };
    for (const block of hero.blocks) {
      if (block.type === "heading" && copy.heroHeading) block.settings.text = copy.heroHeading;
      if (block.type === "text" && copy.heroText) block.settings.text = copy.heroText;
      if (block.type === "button" && copy.heroButton && block.settings.label === hero.blocks.find((item) => item.type === "button")?.settings.label) block.settings.label = copy.heroButton;
    }
  }
  if (hero?.type === "slideshow") {
    const slide = hero.blocks[0];
    if (slide) Object.assign(slide.settings, { ...(copy.heroEyebrow ? { eyebrow: copy.heroEyebrow } : {}), ...(copy.heroHeading ? { heading: copy.heroHeading } : {}), ...(copy.heroText ? { text: copy.heroText } : {}), ...(copy.heroButton ? { buttonLabel: copy.heroButton } : {}), ...(brief.images?.hero ? { image: { url: brief.images.hero, alt: brief.images.heroAlt ?? "" } } : {}) });
  }
  return { menus: rename(pack.menus), globalSections, templates };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const path = process.argv[2];
  if (!path || !existsSync(path)) fail("pass the path of a brief JSON file.");
  const brief = readBrief(JSON.parse(readFileSync(path, "utf8")));
  const manifest = themeManifest(brief);
  const starter = starterFile(brief);
  const manifestCheck = themeManifestSchema.safeParse(manifest);
  if (!manifestCheck.success) fail(`the generated theme.json is invalid: ${manifestCheck.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`);
  const starterCheck = starterFileSchema.safeParse(starter);
  if (!starterCheck.success) fail(`the generated starter.json is invalid: ${starterCheck.error.issues.slice(0, 5).map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`);
  if (process.argv.includes("--print")) {
    console.log(JSON.stringify({ manifest, starter }, null, 2));
  } else {
    const folder = join(packages, "storefront-themes/src/themes", brief.id);
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, "theme.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    writeFileSync(join(folder, "starter.json"), `${JSON.stringify(starter, null, 2)}\n`);
    console.log(`Wrote ${folder}. Next: node scripts/generate-theme-index.mjs, rebuild the packages, then run the design lint.`);
  }
}
