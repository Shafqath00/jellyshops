import { pageTypeLabel } from "@jelly/storefront-registry";
import { isRetainedTemplate, type SelectableTemplate } from "./template-selection";
import { isMainTemplate, selectableTemplates } from "./template-names";

/**
 * Pages the live store builds from sections, in the order the page picker lists them.
 * Checkout, account, wishlist and order pages are built into the store: they follow the
 * theme's colours and fonts, but sections added to them would never show, so the picker
 * leaves them out instead of opening an empty template.
 */
export const EDITABLE_PAGE_TYPES = ["home", "product", "collection", "page", "blog", "article", "cart", "search", "not-found"] as const;

export const BUILT_IN_PAGES_NOTE = "Checkout, account and order pages are built in. They use your theme's colours and fonts.";

export function isEditablePageType(type: string): boolean {
  return (EDITABLE_PAGE_TYPES as readonly string[]).includes(type);
}

type PickerTemplate = SelectableTemplate & { name: string };

export interface PagePickerGroup<T extends PickerTemplate> {
  type: string;
  label: string;
  /** The main template first, then the merchant's other templates by name. */
  current: T[];
  /** Templates kept from an earlier store design, newest first. */
  older: T[];
}

/** Page types and their templates for the page picker, filtered by a search. */
export function pagePickerGroups<T extends PickerTemplate>(templates: readonly T[], query = ""): PagePickerGroup<T>[] {
  const match = query.trim().toLowerCase();
  return EDITABLE_PAGE_TYPES.flatMap((type) => {
    const label = pageTypeLabel(type);
    const typeMatches = !match || label.toLowerCase().includes(match);
    const keep = (template: T) => typeMatches || template.name.toLowerCase().includes(match);
    const current = selectableTemplates(templates, type).filter(keep);
    const older = templates.filter((template) => template.type === type && isRetainedTemplate(template)).reverse().filter(keep);
    return typeMatches || current.length || older.length ? [{ type, label, current, older }] : [];
  });
}

/** How a template is named in the picker: "Default" for the main one, "Earlier version" for old ones. */
export function pagePickerTemplateLabel(template: PickerTemplate, olderIndex?: number): string {
  if (isRetainedTemplate(template)) return olderIndex === undefined ? "Earlier version" : `Earlier version ${olderIndex + 1}`;
  return isMainTemplate(template) ? "Default" : template.name;
}

/** The picker button's text: the page, plus the template when it isn't the main one. */
export function pagePickerButtonLabel(template: PickerTemplate | undefined): string {
  const page = pageTypeLabel(template?.type ?? "home");
  if (!template || isMainTemplate(template)) return page;
  return `${page} · ${isRetainedTemplate(template) ? "earlier version" : template.name}`;
}

/** What the "show with" picker asks for on each page type, so it never repeats the word "preview". */
export function previewResourceNoun(type: string): string {
  return ({ product: "product", collection: "collection", page: "page", blog: "blog", article: "blog post" } as Record<string, string>)[type] ?? "item";
}
