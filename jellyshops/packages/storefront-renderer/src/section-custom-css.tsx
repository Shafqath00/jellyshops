import { scopeCustomCss, type SectionNode } from "@jelly/storefront-schema";
import { themeCustomCss } from "@jelly/storefront-themes";

/** The section's own selector for its custom CSS, or null when it has none worth applying. */
function scopeFor(section: SectionNode): { id: string; css: string } | null {
  const id = section.id.replace(/[^\w-]/g, "");
  const css = id ? scopeCustomCss(section.settings.customCss, `[data-section-css="${id}"]`) : null;
  return id && css ? { id, css } : null;
}

/** Spread on the section's wrapper so its custom CSS can find it. */
export function sectionCssProps(section: SectionNode): Record<string, string> {
  const scoped = scopeFor(section);
  return scoped ? { "data-section-css": scoped.id } : {};
}

/**
 * The merchant's custom CSS for one section, already limited to that section
 * and checked to contain no `<` (so it can't end the style element).
 */
export function SectionCustomCss({ section }: { section: SectionNode }) {
  const scoped = scopeFor(section);
  return scoped ? <style data-section-css-for={scoped.id} dangerouslySetInnerHTML={{ __html: scoped.css }} /> : null;
}

/**
 * The theme's custom CSS (theme settings > Custom CSS), limited to the store
 * wrapper (`[data-jelly-theme]`). Render it inside that wrapper.
 */
export function ThemeCustomCss({ settings }: { settings: Record<string, unknown> | undefined }) {
  const css = themeCustomCss(settings);
  return css ? <style data-theme-css="" dangerouslySetInnerHTML={{ __html: css }} /> : null;
}
