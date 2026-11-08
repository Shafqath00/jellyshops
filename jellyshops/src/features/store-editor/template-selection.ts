/**
 * Choosing a template when a store has several of the same page type.
 *
 * Installing another template keeps the old ones (renamed with a `previous-`
 * handle) so earlier drafts stay inspectable, and the API lists templates
 * oldest first. "The first template of this type" is therefore the old
 * template, not the one the merchant just chose.
 */
export interface SelectableTemplate {
  id: string;
  type: string;
  handle: string;
}

export const RETAINED_HANDLE_PREFIX = "previous-";

export function isRetainedTemplate(template: Pick<SelectableTemplate, "handle">): boolean {
  return template.handle.startsWith(RETAINED_HANDLE_PREFIX);
}

/** The template to open for a page type: the active (`default`) one, else any current one, else the newest retained one. */
export function pickTemplateForType<T extends SelectableTemplate>(templates: readonly T[], type: string): T | undefined {
  const matching = templates.filter((template) => template.type === type);
  return matching.find((template) => template.handle === "default") ?? matching.find((template) => !isRetainedTemplate(template)) ?? matching.at(-1);
}

/** The template the editor opens first: the active home page, else any current template, else the first one. */
export function pickInitialTemplate<T extends SelectableTemplate>(templates: readonly T[]): T | undefined {
  return pickTemplateForType(templates, "home") ?? templates.find((template) => !isRetainedTemplate(template)) ?? templates[0];
}
