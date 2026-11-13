import type { BlockNode } from "@jelly/storefront-schema";
import { compareThemeVersions } from "@jelly/storefront-schema";
import { setRuntimeSectionControlTypes } from "@jelly/storefront-registry/runtime";
import type { SectionRecipe } from "./recipes.js";

/** Drawing section recipes on store pages, without zod; recipes.ts checks and registers them for the editor. */
export type RecipeElement =
  | { kind: "heading"; text: string; when?: string }
  | { kind: "text"; text: string; when?: string }
  | { kind: "button"; label: string; href?: string; style?: "primary" | "secondary" | "link"; when?: string }
  | { kind: "image"; image: string; link?: string; ratio?: string; when?: string }
  | { kind: "spacer"; size: number; when?: string }
  | { kind: "products"; limit?: number | string; collection?: string; columns?: number; when?: string }
  | { kind: "group"; direction?: "vertical" | "horizontal"; gap?: number; align?: "start" | "center" | "end" | "between"; elements: RecipeElement[]; when?: string };

const recipes = new Map<string, Map<string, SectionRecipe[]>>();

export function getRecipe(type: string, themeVersion?: string | null): SectionRecipe | undefined {
  const versions = recipes.get(type.split("/")[0]);
  const version = themeVersion ?? (versions && [...versions.keys()].sort(compareThemeVersions).at(-1));
  return version ? versions?.get(version)?.find((recipe) => recipe.type === type) : undefined;
}

const DEFAULTS: Record<string, unknown> = { text: "", textarea: "", link: "", color: "", checkbox: true };

/**
 * A manifest's recipes as the checked list would have them, without checking: store pages use this for themes that
 * were checked when built or uploaded. The main entry replaces it with the checked list (recipesOf) when it loads.
 */
export function uncheckedRecipes(manifest: { sections?: unknown }): SectionRecipe[] {
  if (!Array.isArray(manifest.sections)) return [];
  return manifest.sections.filter((recipe): recipe is Record<string, unknown> => Boolean(recipe) && typeof recipe === "object" && typeof (recipe as { type?: unknown }).type === "string" && Array.isArray((recipe as { elements?: unknown }).elements))
    .map((recipe) => ({
      ...recipe,
      settings: (Array.isArray(recipe.settings) ? recipe.settings : []).map((setting: Record<string, unknown>) => ({
        ...(setting.type === "number" ? { step: 1 } : {}),
        ...(typeof setting.type === "string" && setting.type in DEFAULTS ? { default: DEFAULTS[setting.type] } : {}),
        ...setting,
      })),
      layout: recipe.layout && typeof recipe.layout === "object" ? recipe.layout : {},
    }) as unknown as SectionRecipe);
}

/** Keeps a theme's recipes for drawing (one list per theme version). Returns a function that puts the old list back. */
export function storeRecipes(themeId: string, list: SectionRecipe[], version = "1.0.0"): () => void {
  const snapshot = structuredClone(list);
  const versions = recipes.get(themeId) ?? new Map<string, SectionRecipe[]>();
  const previous = versions.get(version);
  versions.set(version, snapshot); recipes.set(themeId, versions);
  for (const recipe of snapshot) setRuntimeSectionControlTypes(recipe.type, Object.fromEntries(recipe.settings.filter((setting) => ["image", "link", "collection"].includes(setting.type)).map((setting) => [setting.id, setting.type])));
  return () => {
    if (versions.get(version) !== snapshot) return;
    if (previous) versions.set(version, previous); else versions.delete(version);
    if (!versions.size) recipes.delete(themeId);
  };
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
  const shown = (item: RecipeElement) => !item.when || Boolean(values[item.when]);
  const build = (items: RecipeElement[], prefix: string): BlockNode[] => items.flatMap((item, index): BlockNode[] => {
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
      // Generated block types the Custom content section draws for recipes only (merchants cannot add them).
      case "spacer": return [{ id, type: "recipe-spacer", enabled: true, settings: { size: item.size } }];
      case "products": {
        const limit = typeof item.limit === "string" ? Number(values[item.limit.slice(1, -1)]) : item.limit ?? 4;
        const collectionId = item.collection ? values[item.collection.slice(1, -1)] : undefined;
        return [{ id, type: "recipe-products", enabled: true, settings: { limit: Number.isFinite(limit) ? Math.max(1, Math.min(12, Math.round(limit))) : 4, ...(typeof collectionId === "string" && collectionId ? { collectionId } : {}), columns: item.columns ?? 4 } }];
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
