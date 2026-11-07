import type { RuntimeStorefrontSnapshotV4 } from "@jelly/storefront-schema";

function hasToolbarSection(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasToolbarSection);
  if (!value || typeof value !== "object") return false;
  const node = value as { type?: unknown; settings?: Record<string, unknown> };
  if (node.type === "search-results" && (node.settings?.showSort === true || node.settings?.showFilters === true)) return true;
  return Object.values(node).some(hasToolbarSection);
}

/**
 * True when the store's published search page has its own sorting or filters ("Let shoppers sort results" /
 * "filter" on the Search results section). The live search page then draws the theme's page instead of the
 * built-in product browser.
 */
export function searchTemplateHasToolbar(snapshot: Pick<RuntimeStorefrontSnapshotV4, "templates" | "templateDefaults">): boolean {
  const id = snapshot.templateDefaults.search;
  const template = id ? snapshot.templates[id] : undefined;
  return Boolean(template && hasToolbarSection(template.layout));
}
