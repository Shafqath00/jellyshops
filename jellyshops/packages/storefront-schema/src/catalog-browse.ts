/**
 * Shared product list rules: which filters a product belongs to, and how a list is filtered, counted, sorted and
 * paged. The live store's backend route and the editor/theme preview (which filter in the browser) both use these, so
 * a collection behaves the same everywhere.
 *
 * Filter values come from the product's own options (Size, Colour, Storage…), tags written as "Name:Value"
 * ("Fabric:Velvet"; "label:" tags are card chips, not filters), the brand and the product type.
 */

/** One filter a product belongs to, with its values ("Size": ["Double", "King"]). */
export interface ProductFilterValues { name: string; values: string[] }

export type CatalogSort = "featured" | "price-asc" | "price-desc" | "name-asc";
export const CATALOG_SORTS: readonly CatalogSort[] = ["featured", "price-asc", "price-desc", "name-asc"];

export interface CatalogQuery {
  sort?: CatalogSort;
  inStock?: boolean;
  minPriceMinor?: number;
  maxPriceMinor?: number;
  /** Chosen values by filter key (lower-case name): a product matches one value of each filter. */
  filters?: Record<string, readonly string[]>;
  /** Filters to offer, by name, in this order; empty means every filter with two or more values. */
  filterNames?: readonly string[];
  offset?: number;
  limit?: number;
}

export interface CatalogFacet {
  /** Lower-case name, used in queries. */
  key: string;
  label: string;
  values: Array<{ value: string; count: number; selected: boolean }>;
}

export interface CatalogPage<T> {
  items: T[];
  total: number;
  facets: CatalogFacet[];
  /** Cheapest and dearest price in the list before the price filter, for the price boxes' hints. */
  price: { minMinor: number; maxMinor: number } | null;
  /** True when a filter, stock or price choice is active. */
  filtered: boolean;
}

/** What browsing needs to know about a product. */
export interface BrowsableProduct {
  name: string;
  priceMinor: number;
  available: boolean;
  filters: readonly ProductFilterValues[];
}

export const MAX_CATALOG_FILTERS = 10;
export const MAX_FILTER_VALUES = 40;
export const MAX_CATALOG_PAGE = 48;

export const filterKey = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");

type OptionLike = { name?: unknown; label?: unknown; values?: unknown };
type ValueLike = { label?: unknown; name?: unknown; value?: unknown };

/** Builds a product's filter values from its options, tags, brand and type. Values keep their first spelling. */
export function productFilterValues(product: { options?: unknown; variantOptions?: ReadonlyArray<Record<string, unknown> | undefined>; tags?: readonly string[] | null; vendor?: string | null; productType?: string | null }): ProductFilterValues[] {
  const groups = new Map<string, { name: string; values: Map<string, string> }>();
  const add = (name: string, value: string) => {
    const cleanName = name.trim().slice(0, 60), cleanValue = value.trim().slice(0, 80);
    if (!cleanName || !cleanValue) return;
    const key = filterKey(cleanName);
    const group = groups.get(key) ?? { name: cleanName, values: new Map<string, string>() };
    groups.set(key, group);
    const valueKey = cleanValue.toLowerCase();
    if (!group.values.has(valueKey)) group.values.set(valueKey, cleanValue);
  };
  const options = Array.isArray(product.options) ? product.options as OptionLike[] : [];
  for (const option of options) {
    const name = typeof option?.name === "string" ? option.name : typeof option?.label === "string" ? option.label : "";
    const values = Array.isArray(option?.values) ? option.values as ValueLike[] : [];
    for (const value of values) {
      const label = typeof value === "string" ? value : typeof value?.label === "string" ? value.label : typeof value?.name === "string" ? value.name : typeof value?.value === "string" ? value.value : "";
      add(name, label);
    }
  }
  // Older products keep their choices on each variant ({ size: "Large" }) instead of product options.
  if (options.length === 0) {
    for (const variantOptions of product.variantOptions ?? []) {
      for (const [name, value] of Object.entries(variantOptions ?? {})) if (typeof value === "string" && !/^[a-z]+-[0-9a-f-]{8,}$/i.test(name)) add(name.charAt(0).toUpperCase() + name.slice(1), value);
    }
  }
  for (const tag of product.tags ?? []) {
    const separator = tag.indexOf(":");
    if (separator <= 0) continue;
    const name = tag.slice(0, separator);
    if (filterKey(name) === "label") continue;
    add(name, tag.slice(separator + 1));
  }
  if (product.vendor) add("Brand", product.vendor);
  if (product.productType) add("Type", product.productType);
  return [...groups.values()].map((group) => ({ name: group.name, values: [...group.values.values()] }));
}

function matchesFilter(product: BrowsableProduct, key: string, wanted: readonly string[]): boolean {
  if (wanted.length === 0) return true;
  const group = product.filters.find((entry) => filterKey(entry.name) === key);
  if (!group) return false;
  const values = new Set(group.values.map((value) => value.toLowerCase()));
  return wanted.some((value) => values.has(value.toLowerCase()));
}

/** Keeps only sensible choices: known sort, whole-number prices, at most 10 filters of 40 values. */
export function normalizeCatalogQuery(query: CatalogQuery): Required<Omit<CatalogQuery, "minPriceMinor" | "maxPriceMinor">> & Pick<CatalogQuery, "minPriceMinor" | "maxPriceMinor"> {
  const price = (value: number | undefined) => typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.round(value) : undefined;
  const filters: Record<string, string[]> = {};
  for (const [key, values] of Object.entries(query.filters ?? {}).slice(0, MAX_CATALOG_FILTERS)) {
    const clean = [...new Set((values ?? []).filter((value): value is string => typeof value === "string").map((value) => value.trim()).filter((value) => value && value.length <= 80))].slice(0, MAX_FILTER_VALUES);
    if (clean.length) filters[filterKey(key)] = clean;
  }
  return {
    sort: CATALOG_SORTS.includes(query.sort as CatalogSort) ? query.sort as CatalogSort : "featured",
    inStock: query.inStock === true,
    minPriceMinor: price(query.minPriceMinor),
    maxPriceMinor: price(query.maxPriceMinor),
    filters,
    filterNames: (query.filterNames ?? []).map((name) => name.trim()).filter(Boolean).slice(0, MAX_CATALOG_FILTERS),
    offset: Math.max(0, Math.min(10_000, Math.floor(query.offset ?? 0) || 0)),
    limit: Math.max(1, Math.min(MAX_CATALOG_PAGE, Math.floor(query.limit ?? 12) || 12)),
  };
}

/**
 * Filters, counts, sorts and pages a list. A filter's counts ignore that filter's own choices (so the shopper can
 * add a second size), but follow every other choice. Filters with fewer than two values are left out unless chosen.
 */
export function browseCatalog<T>(items: readonly T[], read: (item: T) => BrowsableProduct, rawQuery: CatalogQuery): CatalogPage<T> {
  const query = normalizeCatalogQuery(rawQuery);
  const products = items.map((item) => ({ item, product: read(item) }));
  const chosen = Object.entries(query.filters);
  const passesBase = ({ product }: { product: BrowsableProduct }) => (!query.inStock || product.available)
    && (query.minPriceMinor === undefined || product.priceMinor >= query.minPriceMinor)
    && (query.maxPriceMinor === undefined || product.priceMinor <= query.maxPriceMinor);
  const passesFilters = (entry: { product: BrowsableProduct }, except?: string) => chosen.every(([key, values]) => key === except || matchesFilter(entry.product, key, values));

  // Facet names and values come from the whole list, so choosing a value never makes the other choices vanish.
  const seen = new Map<string, { label: string; values: Map<string, string> }>();
  for (const { product } of products) for (const group of product.filters) {
    const key = filterKey(group.name);
    const entry = seen.get(key) ?? { label: group.name, values: new Map<string, string>() };
    seen.set(key, entry);
    for (const value of group.values) if (!entry.values.has(value.toLowerCase())) entry.values.set(value.toLowerCase(), value);
  }
  const wantedKeys = query.filterNames.length ? query.filterNames.map(filterKey) : [...seen.keys()];
  const facets: CatalogFacet[] = [];
  for (const key of wantedKeys) {
    const entry = seen.get(key);
    if (!entry || facets.some((facet) => facet.key === key)) continue;
    const selected = new Set((query.filters[key] ?? []).map((value) => value.toLowerCase()));
    if (entry.values.size < 2 && selected.size === 0) continue;
    const pool = products.filter((candidate) => passesBase(candidate) && passesFilters(candidate, key));
    const values = [...entry.values.entries()].slice(0, MAX_FILTER_VALUES).map(([lower, value]) => ({
      value,
      count: pool.filter((candidate) => matchesFilter(candidate.product, key, [value])).length,
      selected: selected.has(lower),
    }));
    facets.push({ key, label: entry.label, values });
    if (facets.length >= MAX_CATALOG_FILTERS) break;
  }

  const prices = products.map(({ product }) => product.priceMinor);
  const matching = products.filter((entry) => passesBase(entry) && passesFilters(entry));
  if (query.sort === "name-asc") matching.sort((a, b) => a.product.name.localeCompare(b.product.name));
  else if (query.sort === "price-asc") matching.sort((a, b) => a.product.priceMinor - b.product.priceMinor);
  else if (query.sort === "price-desc") matching.sort((a, b) => b.product.priceMinor - a.product.priceMinor);
  return {
    items: matching.slice(query.offset, query.offset + query.limit).map((entry) => entry.item),
    total: matching.length,
    facets,
    price: prices.length ? { minMinor: Math.min(...prices), maxMinor: Math.max(...prices) } : null,
    filtered: query.inStock || query.minPriceMinor !== undefined || query.maxPriceMinor !== undefined || chosen.length > 0,
  };
}
