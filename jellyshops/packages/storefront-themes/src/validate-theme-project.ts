import { storefrontPageTypes, type PageType, type SectionNode } from "@jelly/storefront-schema";
import { recipesOf, registerRecipes } from "./recipes.js";
import { validateSectionAgainstRegistry } from "@jelly/storefront-registry";
import { themeManifestSchema } from "./theme-resolver.js";

/**
 * Checks a theme project (its manifest and optional starter) with the same rules the platform
 * applies, and says what is wrong in plain words. It reads no files: callers (the
 * `validate-theme` script, tests, and later the upload API) hand it parsed JSON. Declarative
 * themes may contain data, CSS and assets only, so anything executable is an error.
 */
export interface ThemeProjectIssue { level: "error" | "warning"; code: string; path: string; message: string }
export interface ThemeProjectInput {
  manifest: unknown;
  /** `{ globalSections, templates }` as in docs/examples/jelly-studio/starter.json. */
  starter?: unknown;
  /** True when the file exists, for asset paths the manifest names (e.g. `/themes/<id>/preview.svg`). Omit to skip the check. */
  assetExists?(path: string): boolean;
}

const RECOMMENDED_TEMPLATES: PageType[] = ["home", "product", "collection", "cart", "search", "page", "not-found"];
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const hex = /^#[0-9a-fA-F]{6}$/;

/** Text that could run code or load code from elsewhere. Themes may not contain any of it. */
const EXECUTABLE: Array<[RegExp, string]> = [
  [/<\s*(script|iframe|object|embed|style|link|meta|base)\b/i, "contains an HTML tag that can run or load code"],
  [/\bjavascript\s*:|\bvbscript\s*:|\bdata\s*:\s*text\/html/i, "contains a script link"],
  [/\bon[a-z]{3,}\s*=/i, "contains an inline event handler"],
  [/@import\b|expression\s*\(|-moz-binding|behavior\s*:/i, "contains CSS that loads or runs something else"],
  [/\bimport\s*\(|\beval\s*\(|\bnew\s+Function\b/i, "contains JavaScript"],
];
const URL_KEYS = new Set(["url", "href", "src", "link", "path"]);

function scan(value: unknown, path: string, issues: ThemeProjectIssue[]): void {
  if (typeof value === "string") {
    for (const [pattern, message] of EXECUTABLE) if (pattern.test(value)) issues.push({ level: "error", code: "EXECUTABLE_CONTENT", path, message: `${path} ${message}. Themes may contain data, CSS and images only.` });
    return;
  }
  if (Array.isArray(value)) { value.forEach((item, index) => scan(item, `${path}[${index}]`, issues)); return; }
  for (const [key, child] of Object.entries(record(value))) {
    const childPath = path ? `${path}.${key}` : key;
    // A section recipe may take a link from a setting ("{buttonLink}"); the value is checked when it is drawn.
    if (typeof child === "string" && URL_KEYS.has(key) && child && !/^{[a-zA-Z][a-zA-Z0-9]*}$/.test(child) && !(child.startsWith("/") && !child.startsWith("//")) && !/^https:\/\//i.test(child) && !child.startsWith("#") && !/^(mailto|tel):/i.test(child)) {
      issues.push({ level: "error", code: "UNSAFE_URL", path: childPath, message: `${childPath} must be a local path or an https link.` });
    }
    scan(child, childPath, issues);
  }
}

function valueAt(source: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((value, key) => record(value)[key], source);
}

function checkSettings(manifest: Record<string, unknown>, issues: ThemeProjectIssue[]): void {
  const defaults = record(manifest.settingsDefaults);
  const schema = Array.isArray(manifest.settingsSchema) ? manifest.settingsSchema as Array<Record<string, unknown>> : [];
  const seen = new Set<string>();
  schema.forEach((setting, index) => {
    const id = typeof setting.id === "string" ? setting.id : `settingsSchema[${index}]`;
    const path = `settingsSchema[${index}] (${id})`;
    if (seen.has(id)) issues.push({ level: "error", code: "DUPLICATE_SETTING", path, message: `The setting "${id}" is listed twice.` });
    seen.add(id);
    const inDefaults = valueAt(defaults, id);
    if (inDefaults === undefined) issues.push({ level: "error", code: "MISSING_DEFAULT", path, message: `"${id}" has no value in settingsDefaults, so stores would start without it.` });
    else if (JSON.stringify(inDefaults) !== JSON.stringify(setting.default)) issues.push({ level: "error", code: "DEFAULT_MISMATCH", path, message: `"${id}" says its default is ${JSON.stringify(setting.default)} but settingsDefaults has ${JSON.stringify(inDefaults)}.` });
    const options = Array.isArray(setting.options) ? setting.options as Array<{ value: string }> : undefined;
    if (options && !options.some((option) => option.value === setting.default)) issues.push({ level: "error", code: "DEFAULT_NOT_AN_OPTION", path, message: `The default of "${id}" is not one of its choices.` });
    if (typeof setting.default === "number") {
      if (typeof setting.min === "number" && setting.default < setting.min) issues.push({ level: "error", code: "DEFAULT_OUT_OF_RANGE", path, message: `The default of "${id}" is below its minimum.` });
      if (typeof setting.max === "number" && setting.default > setting.max) issues.push({ level: "error", code: "DEFAULT_OUT_OF_RANGE", path, message: `The default of "${id}" is above its maximum.` });
    }
    if (setting.type === "color" && typeof setting.default === "string" && setting.default && !hex.test(setting.default)) issues.push({ level: "error", code: "BAD_COLOUR", path, message: `The default of "${id}" must be a colour like #1a2b3c.` });
  });
  if (!schema.length) issues.push({ level: "warning", code: "NO_SETTINGS", path: "settingsSchema", message: "The theme has no editable settings, so merchants cannot change anything under Theme settings." });
}

type Placement = { kind: "inline"; section: SectionNode } | { kind: "global"; globalSectionId: string };

function checkStarter(starterInput: unknown, themeId: string | undefined, issues: ThemeProjectIssue[]): void {
  const starter = record(starterInput);
  const globals = record(starter.globalSections) as Record<string, SectionNode>;
  const templates = record(starter.templates) as Record<string, { type?: unknown; sections?: unknown }>;
  const ids = new Map<string, string>();
  const claim = (id: unknown, path: string) => {
    if (typeof id !== "string" || !id) { issues.push({ level: "error", code: "MISSING_ID", path, message: `${path} needs an id.` }); return; }
    const first = ids.get(id);
    if (first) issues.push({ level: "error", code: "DUPLICATE_ID", path, message: `The id "${id}" is used at ${first} and ${path}. Ids must be unique.` });
    else ids.set(id, path);
  };
  for (const [key, section] of Object.entries(globals)) claim(section?.id, `globalSections.${key}`);
  const used = new Set<string>();
  for (const [key, template] of Object.entries(templates)) {
    const type = template?.type as PageType;
    if (!storefrontPageTypes.includes(type)) { issues.push({ level: "error", code: "UNKNOWN_PAGE_TYPE", path: `templates.${key}.type`, message: `"${String(template?.type)}" is not a page type. Use one of: ${storefrontPageTypes.join(", ")}.` }); continue; }
    const placements = Array.isArray(template.sections) ? template.sections as Placement[] : [];
    if (!placements.length) issues.push({ level: "warning", code: "EMPTY_TEMPLATE", path: `templates.${key}`, message: `The ${key} template has no sections.` });
    placements.forEach((placement, index) => {
      const path = `templates.${key}.sections[${index}]`;
      let section: SectionNode | undefined;
      if (placement.kind === "global") {
        section = globals[placement.globalSectionId];
        if (!section) { issues.push({ level: "error", code: "MISSING_GLOBAL_SECTION", path, message: `Refers to the shared section "${placement.globalSectionId}", which is not in globalSections.` }); return; }
        used.add(placement.globalSectionId);
      } else if (placement.kind === "inline") {
        section = placement.section;
        claim(section?.id, `${path}.section`);
        for (const block of section?.blocks ?? []) {
          claim(block?.id, `${path}.section.blocks`);
          for (const child of block?.blocks ?? []) claim(child?.id, `${path}.section.blocks`);
        }
      } else { issues.push({ level: "error", code: "BAD_PLACEMENT", path, message: 'A placement must be { "kind": "inline", "section": … } or { "kind": "global", "globalSectionId": … }.' }); return; }
      for (const issue of validateSectionAgainstRegistry(section, type, themeId)) {
        issues.push({ level: "error", code: issue.code, path: `${path}${issue.blockId ? ` block ${issue.blockId}` : ""}`, message: `${section.type} (${section.id}): ${issue.message}` });
      }
    });
  }
  for (const key of Object.keys(globals)) if (!used.has(key)) issues.push({ level: "warning", code: "UNUSED_GLOBAL_SECTION", path: `globalSections.${key}`, message: `The shared section "${key}" is not used by any template.` });
  const present = new Set(Object.values(templates).map((template) => template?.type));
  for (const type of RECOMMENDED_TEMPLATES) if (!present.has(type)) issues.push({ level: "warning", code: "MISSING_TEMPLATE", path: "templates", message: `No ${type === "page" ? "information page (page)" : type} template. Stores that choose this theme would start without a layout for it.` });
}

export function validateThemeProject(input: ThemeProjectInput): ThemeProjectIssue[] {
  const issues: ThemeProjectIssue[] = [];
  const parsed = themeManifestSchema.safeParse(input.manifest);
  if (!parsed.success) {
    for (const problem of parsed.error.issues) {
      const path = problem.path.length ? problem.path.join(".") : "theme.json";
      issues.push({ level: "error", code: "MANIFEST_INVALID", path, message: problem.code === "unrecognized_keys" ? `Unknown field${problem.keys.length > 1 ? "s" : ""} ${problem.keys.map((key) => `"${key}"`).join(", ")}. The manifest only allows the documented fields.` : `${path}: ${problem.message}` });
    }
  } else {
    checkSettings(record(input.manifest), issues);
    const assets = parsed.data.assets;
    const named = [parsed.data.previewAsset, assets.preview?.path, ...[...assets.stylesheets, ...assets.scripts, ...assets.icons, ...assets.assets].map((asset) => asset.path), ...assets.fonts.map((font) => font.path)].filter((path): path is string => Boolean(path));
    if (assets.scripts.length) issues.push({ level: "error", code: "SCRIPTS_NOT_ALLOWED", path: "assets.scripts", message: "Declarative themes cannot include scripts. Remove assets.scripts." });
    if (input.assetExists) for (const path of new Set(named)) if (!input.assetExists(path)) issues.push({ level: path === parsed.data.previewAsset || path === assets.preview?.path ? "warning" : "error", code: "ASSET_MISSING", path, message: `The file ${path} is named in the manifest but was not found.` });
  }
  scan(input.manifest, "theme.json", issues);
  if (input.starter !== undefined) {
    // The theme's own sections must be known while its starter is checked, and only then: validating a theme must not leave it registered.
    const id = typeof record(input.manifest).id === "string" ? record(input.manifest).id as string : undefined;
    const undo = parsed.success && id ? registerRecipes(id, recipesOf(parsed.data)) : () => {};
    try { checkStarter(input.starter, id, issues); } finally { undo(); }
    scan(input.starter, "starter.json", issues);
  }
  // Same message twice (from the schema and the scan) is noise.
  const seen = new Set<string>();
  return issues.filter((issue) => { const key = `${issue.code}|${issue.path}|${issue.message}`; if (seen.has(key)) return false; seen.add(key); return true; });
}
