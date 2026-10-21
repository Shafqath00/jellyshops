import { safeRichTextHref, type MediaReference, type SectionNode } from "@jelly/storefront-schema";

type Settings = Record<string, unknown>;

export function stringValue(settings: Settings | undefined, key: string, fallback = ""): string {
  const value = settings?.[key];
  return typeof value === "string" && value.trim() ? value : fallback;
}

export function numberValue(settings: Settings | undefined, key: string, fallback: number, min: number, max: number): number {
  const value = settings?.[key];
  return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback;
}

export function choice<T extends string>(settings: Settings | undefined, key: string, options: readonly T[], fallback: T): T {
  const value = settings?.[key];
  return typeof value === "string" && (options as readonly string[]).includes(value) ? value as T : fallback;
}

/** A saved image setting with a safe URL, or undefined. */
export function imageValue(settings: Settings | undefined, key = "image"): (MediaReference & { url: string }) | undefined {
  const candidate = settings?.[key];
  if (!candidate || typeof candidate !== "object" || !("url" in candidate) || typeof candidate.url !== "string") return undefined;
  const url = safeRichTextHref(candidate.url);
  return url && !url.startsWith("#") ? { ...(candidate as MediaReference), url } : undefined;
}

/** A section heading saved as empty text (with no heading block) means "no heading", not "use the default". */
export function headingHidden(section: SectionNode): boolean {
  return section.settings.heading === "" && !visibleBlocks(section, "heading").length;
}

export function visibleBlocks(section: SectionNode, type?: string) {
  return section.blocks.filter((block) => block.enabled && (!type || block.type === type));
}

/** Data attributes themes use to style a section's background and layout without per-theme markup. */
export function sectionData(section: SectionNode, extra: Record<string, string | undefined> = {}) {
  return {
    "data-section-id": section.id,
    "data-color-scheme": choice(section.settings, "colorScheme", ["page", "soft", "dark"] as const, "page"),
    ...extra,
  };
}
