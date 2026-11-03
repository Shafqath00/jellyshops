import { registerSection, unregisterSection, type ControlDefinition, type SectionDefinition } from "@jelly/storefront-registry";
import { storefrontPageTypes, type BlockNode } from "@jelly/storefront-schema";
import { z } from "zod";

/**
 * Section recipes: a custom section a theme describes as data. A recipe lists the settings the
 * merchant can edit and a small set of elements (heading, text, button, image, group) that use
 * those settings. The platform draws it with the existing Custom content section, so a recipe gets
 * the shared style controls, translations and editor support, and can never run code.
 *
 * Elements refer to settings with `{settingId}`; there are no expressions or conditions beyond
 * `when` (show the element only while a checkbox setting is on).
 */
const settingId = z.string().regex(/^[a-zA-Z][a-zA-Z0-9]{0,39}$/, "Setting ids use letters and numbers and start with a letter.");
const label = z.string().min(1).max(60);
const choiceOption = z.object({ label: z.string().min(1).max(40), value: z.string().min(1).max(40) }).strict();

const settingSchema = z.discriminatedUnion("type", [
  z.object({ id: settingId, type: z.literal("text"), label, default: z.string().max(300).default("") }).strict(),
  z.object({ id: settingId, type: z.literal("textarea"), label, default: z.string().max(1000).default("") }).strict(),
  z.object({ id: settingId, type: z.literal("number"), label, default: z.number(), min: z.number(), max: z.number(), step: z.number().positive().default(1) }).strict(),
  z.object({ id: settingId, type: z.literal("select"), label, options: z.array(choiceOption).min(1).max(12), default: z.string() }).strict(),
  z.object({ id: settingId, type: z.literal("checkbox"), label, default: z.boolean().default(true) }).strict(),
  z.object({ id: settingId, type: z.literal("color"), label, default: z.string().regex(/^(#[0-9a-fA-F]{6})?$/).default("") }).strict(),
  z.object({ id: settingId, type: z.literal("image"), label }).strict(),
  z.object({ id: settingId, type: z.literal("link"), label, default: z.string().max(300).default("") }).strict(),
]);

const when = z.string().optional();
const text = z.string().max(400);

type Element =
  | { kind: "heading"; text: string; when?: string }
  | { kind: "text"; text: string; when?: string }
  | { kind: "button"; label: string; href?: string; style?: "primary" | "secondary" | "link"; when?: string }
  | { kind: "image"; image: string; link?: string; ratio?: string; when?: string }
  | { kind: "group"; direction?: "vertical" | "horizontal"; gap?: number; align?: "start" | "center" | "end" | "between"; elements: Element[]; when?: string };

const leaf = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("heading"), text, when }).strict(),
  z.object({ kind: z.literal("text"), text, when }).strict(),
  z.object({ kind: z.literal("button"), label: z.string().max(60), href: z.string().max(300).optional(), style: z.enum(["primary", "secondary", "link"]).optional(), when }).strict(),
  z.object({ kind: z.literal("image"), image: z.string().max(80), link: z.string().max(300).optional(), ratio: z.enum(["square", "portrait", "landscape", "wide"]).optional(), when }).strict(),
]);
const group = (inner: z.ZodType<Element>): z.ZodType<Element> => z.object({
  kind: z.literal("group"), direction: z.enum(["vertical", "horizontal"]).optional(), gap: z.number().int().min(0).max(80).optional(),
  align: z.enum(["start", "center", "end", "between"]).optional(), elements: z.array(inner).min(1).max(8), when,
}).strict() as never;
// A group may hold one more group, like the editor's group block (three levels in all).
const innerGroup = group(leaf as never);
const element: z.ZodType<Element> = z.union([leaf as never, innerGroup, group(z.union([leaf as never, innerGroup]) as never)]) as never;

export const recipeSchema = z.object({
  /** `<theme id>/<name>`: the theme id keeps recipes of different themes apart. */
  type: z.string().regex(/^[a-z][a-z0-9-]{1,62}\/[a-z][a-z0-9-]{1,40}$/, "A section type is written theme-id/section-name, in lowercase letters, numbers and dashes."),
  name: label,
  supportedPages: z.array(z.enum(storefrontPageTypes)).min(1).max(12),
  settings: z.array(settingSchema).max(24).default([]),
  layout: z.object({
    direction: z.enum(["vertical", "horizontal"]).optional(),
    align: z.enum(["left", "center", "right"]).optional(),
    gap: z.number().int().min(0).max(80).optional(),
    width: z.enum(["narrow", "normal", "wide", "full"]).optional(),
  }).strict().default({}),
  elements: z.array(element).min(1).max(12),
}).strict().superRefine((recipe, context) => {
  const ids = recipe.settings.map((setting) => setting.id);
  ids.forEach((id, index) => { if (ids.indexOf(id) !== index) context.addIssue({ code: "custom", path: ["settings", index, "id"], message: `The setting "${id}" is listed twice.` }); });
  const byId = new Map(recipe.settings.map((setting) => [setting.id, setting]));
  const known = (name: string, path: Array<string | number>, expected?: string[]) => {
    const setting = byId.get(name);
    if (!setting) context.addIssue({ code: "custom", path, message: `"${name}" is not one of this section's settings.` });
    else if (expected && !expected.includes(setting.type)) context.addIssue({ code: "custom", path, message: `"${name}" is a ${setting.type} setting, but this needs a ${expected.join(" or ")} setting.` });
  };
  const placeholders = (value: string | undefined, path: Array<string | number>) => { for (const match of value?.matchAll(/\{([^{}]*)\}/g) ?? []) known(match[1], path); };
  const walk = (elements: Element[], path: Array<string | number>) => elements.forEach((item, index) => {
    const here = [...path, index];
    if (item.when) known(item.when, [...here, "when"], ["checkbox"]);
    if (item.kind === "heading" || item.kind === "text") placeholders(item.text, [...here, "text"]);
    if (item.kind === "button") { placeholders(item.label, [...here, "label"]); placeholders(item.href, [...here, "href"]); }
    if (item.kind === "image") {
      const exact = item.image.match(/^\{([^{}]+)\}$/);
      if (exact) known(exact[1], [...here, "image"], ["image"]); else context.addIssue({ code: "custom", path: [...here, "image"], message: 'An image uses one image setting, written like "{photo}".' });
      placeholders(item.link, [...here, "link"]);
    }
    if (item.kind === "group") walk(item.elements, [...here, "elements"]);
  });
  walk(recipe.elements, ["elements"]);
});

export type SectionRecipe = z.infer<typeof recipeSchema>;

const imageValue = z.object({ url: z.string(), alt: z.string().optional() }).passthrough();

function settingControl(setting: SectionRecipe["settings"][number]): { control: ControlDefinition; schema: z.ZodType } {
  const base = { key: setting.id, label: setting.label, group: "content" as const };
  switch (setting.type) {
    case "text": return { control: { ...base, type: "text", maxLength: 300 }, schema: z.string().max(300).optional() };
    case "textarea": return { control: { ...base, type: "textarea", maxLength: 1000 }, schema: z.string().max(1000).optional() };
    case "number": return { control: { ...base, type: "number", min: setting.min, max: setting.max, step: setting.step }, schema: z.number().min(setting.min).max(setting.max).optional() };
    case "select": return { control: { ...base, type: "select", options: setting.options }, schema: z.enum(setting.options.map((option) => option.value) as [string, ...string[]]).optional() };
    case "checkbox": return { control: { ...base, type: "checkbox" }, schema: z.boolean().optional() };
    case "color": return { control: { ...base, type: "color", allowAlpha: false }, schema: z.union([z.string().regex(/^#[0-9a-fA-F]{6}$/), z.literal("")]).optional() };
    case "image": return { control: { ...base, type: "image" }, schema: imageValue.nullable().optional() };
    case "link": return { control: { ...base, type: "link" }, schema: z.string().max(500).optional() };
  }
}

/** The section the registry and editor see for a recipe. */
export function recipeDefinition(themeId: string, recipe: SectionRecipe): SectionDefinition {
  const parts = recipe.settings.map(settingControl);
  const defaults: Record<string, unknown> = {};
  for (const setting of recipe.settings) if ("default" in setting) defaults[setting.id] = setting.default;
  return {
    type: recipe.type, label: recipe.name, category: "content", supportedPages: recipe.supportedPages,
    settingsSchema: z.object(Object.fromEntries(recipe.settings.map((setting, index) => [setting.id, parts[index].schema]))).passthrough(),
    controls: parts.map((part) => part.control), allowedBlockTypes: [], defaultSettings: defaults, defaultBlocks: [], responsiveFields: [],
    themes: [themeId],
  };
}

const recipes = new Map<string, { themeId: string; recipe: SectionRecipe }>();

export function getRecipe(type: string): SectionRecipe | undefined { return recipes.get(type)?.recipe; }

/**
 * Makes a theme's recipes known: registers each as a section limited to the theme, and removes
 * recipes of the same theme that are no longer listed. Returns a function that puts things back
 * as they were (the project validator uses it to try a theme out without keeping it).
 */
export function registerRecipes(themeId: string, list: SectionRecipe[]): () => void {
  const undo: Array<() => void> = [];
  const keep = new Set(list.map((recipe) => recipe.type));
  for (const [type, entry] of [...recipes]) {
    if (entry.themeId !== themeId || keep.has(type)) continue;
    const old = entry;
    unregisterSection(type);
    recipes.delete(type);
    undo.push(() => { registerSection(recipeDefinition(themeId, old.recipe), { replace: true }); recipes.set(type, old); });
  }
  for (const recipe of list) {
    const previous = recipes.get(recipe.type);
    const restore = registerSection(recipeDefinition(themeId, recipe), { replace: true });
    recipes.set(recipe.type, { themeId, recipe });
    undo.push(() => { restore(); if (previous) recipes.set(recipe.type, previous); else recipes.delete(recipe.type); });
  }
  return () => { for (const step of undo.reverse()) step(); };
}

/** The recipes written in a manifest's `sections`, parsed (invalid ones are skipped; the manifest check reports them). */
export function recipesOf(manifest: { sections?: unknown }): SectionRecipe[] {
  const parsed = z.array(recipeSchema).safeParse(manifest.sections ?? []);
  return parsed.success ? parsed.data : [];
}

const BUTTON_STYLES = { primary: "primary", secondary: "secondary", link: "link" } as const;

function fill(template: string, values: Record<string, unknown>): string {
  return template.replace(/\{([^{}]*)\}/g, (_match, id: string) => { const value = values[id]; return value === undefined || value === null ? "" : String(value); });
}

/**
 * Turns a recipe and a section's settings into what the Custom content section draws: its own
 * settings and a list of blocks. Settings the merchant never touched use the recipe's defaults.
 */
export function expandRecipe(recipe: SectionRecipe, saved: Record<string, unknown>): { settings: Record<string, unknown>; blocks: BlockNode[] } {
  const values: Record<string, unknown> = {};
  for (const setting of recipe.settings) values[setting.id] = saved[setting.id] !== undefined ? saved[setting.id] : "default" in setting ? setting.default : undefined;
  const shown = (item: Element) => !item.when || Boolean(values[item.when]);
  const build = (items: Element[], prefix: string): BlockNode[] => items.flatMap((item, index): BlockNode[] => {
    if (!shown(item)) return [];
    const id = `${prefix}${index}`;
    switch (item.kind) {
      case "heading": return [{ id, type: "heading", enabled: true, settings: { text: fill(item.text, values) } }];
      case "text": return [{ id, type: "text", enabled: true, settings: { text: fill(item.text, values) } }];
      case "button": return [{ id, type: "button", enabled: true, settings: { label: fill(item.label, values), href: item.href ? fill(item.href, values) : "", ...(item.style ? { buttonStyle: BUTTON_STYLES[item.style] } : {}) } }];
      case "image": {
        const image = values[item.image.slice(1, -1)];
        if (!image) return [];
        return [{ id, type: "image", enabled: true, settings: { image, ...(item.link ? { link: fill(item.link, values) } : {}), ...(item.ratio ? { aspectRatio: item.ratio } : {}) } }];
      }
      case "group": return [{ id, type: "group", enabled: true, settings: { groupDirection: item.direction ?? "vertical", ...(item.gap !== undefined ? { groupGap: item.gap } : {}), ...(item.align ? { groupAlign: item.align } : {}) }, blocks: build(item.elements, `${id}-`) }];
    }
  });
  const layout = recipe.layout;
  return {
    settings: { direction: layout.direction ?? "vertical", contentAlignment: layout.align ?? "center", gap: layout.gap ?? 16, contentWidth: layout.width ?? "normal" },
    blocks: build(recipe.elements, "recipe-"),
  };
}
