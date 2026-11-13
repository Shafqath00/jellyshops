import { CATALOG_SORTS, filterKey } from "@jelly/storefront-schema";
import type { ProductListFilters, ProductListSort } from "./product-list-browser";

/**
 * Product list choices in the page address, so a filtered collection or search can be shared, bookmarked, reloaded
 * and opened in a new tab (Shopify keeps its filters in the address the same way). Words used:
 *
 *   sort=price-asc        stock=1         min=200  max=900  (whole currency units)
 *   f.size=king&f.size=double&f.colour=natural   (one f.<filter> per chosen value; filter names lower case)
 *
 * Other parts of the address (q, lang, variant, …) are left as they are.
 */
const LIST_KEYS = new Set(["sort", "stock", "min", "max"]);
const isListKey = (key: string) => LIST_KEYS.has(key) || key.startsWith("f.");
const price = (value: string | null) => value && /^\d{1,7}(\.\d{1,2})?$/.test(value.trim()) ? value.trim() : "";

export interface ListAddressState { sort: ProductListSort; filters: ProductListFilters }

/** The choices an address asks for; anything unknown or malformed is ignored. */
export function readListAddress(search: string): ListAddressState {
  const params = new URLSearchParams(search);
  const sort = params.get("sort");
  const values: Record<string, string[]> = {};
  for (const [key, value] of params) {
    if (!key.startsWith("f.") || !value.trim()) continue;
    const name = filterKey(key.slice(2));
    if (!name || name.length > 60 || value.length > 120) continue;
    const list = values[name] ?? (values[name] = []);
    if (!list.includes(value.trim()) && list.length < 20) list.push(value.trim());
  }
  return {
    sort: CATALOG_SORTS.includes(sort as ProductListSort) ? sort as ProductListSort : "featured",
    filters: { inStock: params.get("stock") === "1", min: price(params.get("min")), max: price(params.get("max")), colours: [], values },
  };
}

/** `search` with the list's words replaced by these choices ("" when nothing is left, else starting with "?"). */
export function writeListAddress(search: string, sort: ProductListSort, filters: ProductListFilters): string {
  const params = new URLSearchParams(search);
  for (const key of [...params.keys()]) if (isListKey(key)) params.delete(key);
  if (sort !== "featured") params.set("sort", sort);
  if (filters.inStock) params.set("stock", "1");
  if (price(filters.min)) params.set("min", price(filters.min));
  if (price(filters.max)) params.set("max", price(filters.max));
  const values: Record<string, string[]> = { ...(filters.values ?? {}) };
  if (filters.colours.length) values.colour = [...new Set([...(values.colour ?? []), ...filters.colours])];
  for (const [name, chosen] of Object.entries(values)) for (const value of chosen) params.append(`f.${name}`, value);
  // Nothing of the list's changed: keep the address exactly as it was (no re-encoding of the rest).
  const listPart = (query: URLSearchParams) => [...query].filter(([key]) => isListKey(key)).map(([key, value]) => `${key}=${value}`).sort().join("&");
  if (listPart(params) === listPart(new URLSearchParams(search))) return search;
  const text = params.toString();
  return text ? `?${text}` : "";
}
