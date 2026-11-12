/**
 * "You may also like": one recommendation rule for the live store, the editor preview and the theme preview
 * (Shopify computes related products on the platform; Jelly does it here, from the products the page already has).
 *
 * Ranking, strongest first: same collection, same category, same product type, shared tags, same brand. Featured
 * products break ties, then the catalogue's own order. Other products always fill the remaining places, so every
 * store with two or more products shows recommendations. Other colours of the same design (`family:` tags) are left
 * out: the product page already links them as colour swatches.
 */
export interface RecommendationSignals {
  id: string;
  collectionIds?: readonly string[];
  categoryIds?: readonly string[];
  productType?: string;
  vendor?: string;
  tags?: readonly string[];
  featured?: boolean;
}

const FAMILY_TAG = /^family:\s*(.+)$/i;
const IGNORED_TAG = /^(family|label):/i;
const lower = (value: string | undefined) => value?.trim().toLowerCase() || undefined;
const shared = (a: readonly string[] | undefined, b: readonly string[] | undefined) => (a ?? []).some((item) => (b ?? []).includes(item));
const familyOf = (tags: readonly string[] | undefined) => tags?.map((tag) => FAMILY_TAG.exec(tag)?.[1]?.trim().toLowerCase()).find(Boolean);

/** How closely `candidate` matches `current` (0: nothing in common). */
export function recommendationScore(current: RecommendationSignals, candidate: RecommendationSignals): number {
  let score = 0;
  if (shared(current.collectionIds, candidate.collectionIds)) score += 8;
  if (shared(current.categoryIds, candidate.categoryIds)) score += 6;
  if (lower(current.productType) && lower(current.productType) === lower(candidate.productType)) score += 4;
  const tags = new Set((current.tags ?? []).filter((tag) => !IGNORED_TAG.test(tag)).map((tag) => tag.toLowerCase()));
  score += Math.min(3, 2 * (candidate.tags ?? []).filter((tag) => tags.has(tag.toLowerCase())).length);
  if (lower(current.vendor) && lower(current.vendor) === lower(candidate.vendor)) score += 1;
  return score;
}

/** Up to `limit` items to recommend on `current`'s page, best match first. */
export function recommendProducts<T>(current: RecommendationSignals, items: readonly T[], signals: (item: T) => RecommendationSignals, limit = 4): T[] {
  const family = familyOf(current.tags);
  return items
    .map((item, index) => ({ item, index, signal: signals(item) }))
    .filter(({ signal }) => signal.id !== current.id && !(family && familyOf(signal.tags) === family))
    .map((entry) => ({ ...entry, score: recommendationScore(current, entry.signal) }))
    .sort((a, b) => b.score - a.score || Number(Boolean(b.signal.featured)) - Number(Boolean(a.signal.featured)) || a.index - b.index)
    .slice(0, Math.max(0, limit))
    .map(({ item }) => item);
}

/** Signals of a catalogue product (the live store's products). */
export function productSignals(product: {
  id: string; collectionIds?: string[]; primaryCategoryId?: string; additionalCategoryIds?: string[]; productType?: string; vendor?: string; tags?: string[]; featured?: boolean;
}): RecommendationSignals {
  return {
    id: product.id,
    collectionIds: product.collectionIds,
    categoryIds: [product.primaryCategoryId, ...(product.additionalCategoryIds ?? [])].filter((id): id is string => Boolean(id)),
    productType: product.productType,
    vendor: product.vendor,
    tags: product.tags,
    featured: product.featured,
  };
}

/** Signals of a product card (sample data): its list filters stand in for type, brand and tags. */
export function cardSignals(card: { id: string; vendor?: string; filters?: Array<{ name: string; values: string[] }> }): RecommendationSignals {
  const filters = card.filters ?? [];
  const value = (name: string) => filters.find((filter) => filter.name.toLowerCase() === name)?.values[0];
  return {
    id: card.id,
    productType: value("type"),
    vendor: card.vendor ?? value("brand"),
    tags: filters.filter((filter) => !["type", "brand"].includes(filter.name.toLowerCase())).flatMap((filter) => filter.values.map((item) => `${filter.name}:${item}`)),
  };
}
