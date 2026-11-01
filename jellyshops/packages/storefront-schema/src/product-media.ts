import { getVisibleOptions, type OptionSelection, type ProductOptionLike } from "./product-options.js";

export const MAX_PRODUCT_PHOTOS = 30;
export type MediaAssignments = Record<string, string[]>;
export interface ProductMediaLike {
  id: string;
  url: string;
  appliesTo?: MediaAssignments;
  position?: number;
  altText?: string | null;
  width?: number | null;
  height?: number | null;
  mimeType?: string;
  originalName?: string;
}
export interface ProductMediaInput { mediaId: string; altText?: string | null; appliesTo?: MediaAssignments }
export interface MediaAssignmentIssue { code: string; message: string; mediaId?: string }

export function isProductMediaEnabled(storeId: string, configuredIds: string | undefined): boolean {
  const ids = configuredIds?.split(",").map((id) => id.trim()) ?? [];
  return ids.includes("*") || ids.includes(storeId);
}

/** Resolves presentation only. Purchase selections are never inferred or changed. */
export function resolveProductGallery<T extends ProductMediaLike>(media: T[], options: ProductOptionLike[], selections: OptionSelection[]): T[] {
  const ordered = media.map((item, index) => ({ item, index })).sort((a, b) => (a.item.position ?? a.index) - (b.item.position ?? b.index)).map(({ item }) => item);
  const validSelections = selections.filter((pick) => options.some((option) => option.id === pick.optionId && option.values.some((value) => value.id === pick.valueId)));
  const visible = new Set(getVisibleOptions(options, validSelections).map((option) => option.id));
  // A hidden conditional choice must never expose its assigned photos, even in fallback.
  const eligible = ordered.filter((item) => Object.keys(item.appliesTo ?? {}).every((id) => visible.has(id)));
  const relevant = validSelections.filter((pick) => visible.has(pick.optionId) && eligible.some((item) => Object.hasOwn(item.appliesTo ?? {}, pick.optionId)));
  if (!relevant.length) return eligible;
  const selected = new Map<string, Set<string>>();
  for (const pick of relevant) selected.set(pick.optionId, new Set([...(selected.get(pick.optionId) ?? []), pick.valueId]));
  const shared = eligible.filter((item) => Object.keys(item.appliesTo ?? {}).length === 0);
  const matches = eligible.filter((item) => Object.entries(item.appliesTo ?? {}).every(([id, values]) => !selected.has(id) || values.some((value) => selected.get(id)!.has(value))));
  const tagged = matches.filter((item) => Object.keys(item.appliesTo ?? {}).length > 0);
  const result = [...tagged, ...shared];
  return result.length ? result : eligible;
}

export function validateMediaAssignments(media: Array<ProductMediaLike | ProductMediaInput>, options: ProductOptionLike[]): MediaAssignmentIssue[] {
  const issues: MediaAssignmentIssue[] = [];
  if (media.length > MAX_PRODUCT_PHOTOS) issues.push({ code: "media_limit", message: `A product can have at most ${MAX_PRODUCT_PHOTOS} photos.` });
  const seen = new Set<string>();
  for (const item of media) {
    const mediaId = "mediaId" in item ? item.mediaId : item.id;
    if (seen.has(mediaId)) issues.push({ code: "duplicate_media", mediaId, message: "A photo can appear only once in a product gallery." });
    seen.add(mediaId);
    const tags = item.appliesTo;
    if (tags === undefined) continue;
    if (tags === null || typeof tags !== "object" || Array.isArray(tags)) {
      issues.push({ code: "invalid_assignments", mediaId, message: "Photo assignments must be an object." });
      continue;
    }
    for (const [id, values] of Object.entries(tags)) {
      const option = options.find((candidate) => candidate.id === id);
      if (!option || !Array.isArray(values) || !values.length || new Set(values).size !== values.length || values.some((value) => typeof value !== "string" || !option.values.some((candidate) => candidate.id === value))) {
        issues.push({ code: "invalid_assignment", mediaId, message: "A photo refers to a missing choice or value, or has an empty assignment." });
      }
    }
  }
  return issues;
}

export function pruneMediaAssignments<T extends ProductMediaLike>(media: T[], options: ProductOptionLike[]): { media: T[]; removedMediaIds: string[]; changedMediaIds: string[] } {
  const removedMediaIds: string[] = [];
  const changedMediaIds: string[] = [];
  const kept: T[] = [];
  for (const item of media) {
    const previous = item.appliesTo ?? {};
    const tags = Object.fromEntries(Object.entries(previous).flatMap(([id, values]) => {
      const option = options.find((candidate) => candidate.id === id);
      const valid = values.filter((value) => option?.values.some((candidate) => candidate.id === value));
      return valid.length ? [[id, valid]] : [];
    }));
    if (JSON.stringify(previous) !== JSON.stringify(tags)) changedMediaIds.push(item.id);
    if (Object.keys(previous).length && !Object.keys(tags).length) removedMediaIds.push(item.id);
    else kept.push({ ...item, appliesTo: tags });
  }
  return { media: kept, removedMediaIds, changedMediaIds };
}

const words = (value: string) => value.normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
export function suggestAssignmentsFromFilenames(media: ProductMediaLike[], options: ProductOptionLike[]): Array<{ mediaId: string; appliesTo: MediaAssignments }> {
  return media.flatMap((item) => {
    if (!item.originalName || Object.keys(item.appliesTo ?? {}).length) return [];
    const filename = ` ${words(item.originalName.replace(/\.[^.]+$/, ""))} `;
    const appliesTo: MediaAssignments = {};
    for (const option of options) {
      const matched = option.values.filter((value) => words(value.label) && filename.includes(` ${words(value.label)} `));
      if (matched.length === 1) appliesTo[option.id] = [matched[0].id];
    }
    return Object.keys(appliesTo).length ? [{ mediaId: item.id, appliesTo }] : [];
  });
}

/** Only uploaded media supports derivatives; legacy external URLs stay untouched. */
export function productMediaUrl(url: string, width: 320 | 640 | 1280): string {
  if (!/\/api\/public\/media\/[^/?#]+\/[^/?#]+(?:[?#]|$)/.test(url)) return url;
  const [base, hash] = url.split("#", 2);
  const [pathname, query] = base.split("?", 2);
  const params = new URLSearchParams(query);
  params.set("w", String(width));
  return `${pathname}?${params}${hash === undefined ? "" : `#${hash}`}`;
}

export function productMediaSrcSet(media: ProductMediaLike): string | undefined {
  if (productMediaUrl(media.url, 320) === media.url) return undefined;
  // Avoid false width descriptors when a source is smaller than a target size.
  const widths = ([320, 640, 1280] as const).filter((width) => !media.width || width <= media.width);
  const sources = widths.map((width) => `${productMediaUrl(media.url, width)} ${width}w`);
  if (media.width && media.width < 1280 && !widths.some((width) => width === media.width)) sources.push(`${media.url} ${media.width}w`);
  return sources.join(", ") || undefined;
}
