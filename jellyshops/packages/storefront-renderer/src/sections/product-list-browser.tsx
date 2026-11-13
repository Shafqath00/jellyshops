import { ProductCard } from "../product-card";
import { useEffect, useId, useMemo, useState, type CSSProperties } from "react";
import { browseCatalog, filterKey, type BrowsableProduct, type CatalogFacet, type CatalogQuery, type CatalogSort } from "@jelly/storefront-schema";
import type { CatalogBrowsePage, ListAddress, PublicProduct } from "../types";
import { readListAddress, writeListAddress } from "./list-address";

export type ProductListSort = CatalogSort;

export const PRODUCT_LIST_SORTS: ReadonlyArray<{ value: ProductListSort; label: string }> = [
  { value: "featured", label: "Featured" },
  { value: "price-asc", label: "Price, low to high" },
  { value: "price-desc", label: "Price, high to low" },
  { value: "name-asc", label: "Name, A to Z" },
];

/** The shopper's choices. Prices are typed in whole currency units ("200"); `values` holds chosen filter values by filter key. */
export interface ProductListFilters { inStock: boolean; min: string; max: string; colours: string[]; values?: Record<string, string[]> }
const NO_FILTERS: ProductListFilters = { inStock: false, min: "", max: "", colours: [], values: {} };

/** A product's price in minor units: the exact amount when the store sent it, otherwise read from the shown price. */
export function productPriceMinor(product: PublicProduct): number {
  if (typeof product.priceMinor === "number") return product.priceMinor;
  const digits = product.price.replace(/[^0-9.,]/g, "");
  // "1,197.00" and "1.197,00" both read as 1197.00: the last separator followed by two digits is the decimal point.
  const decimal = /[.,](\d{2})$/.exec(digits);
  const whole = (decimal ? digits.slice(0, -3) : digits).replace(/[.,]/g, "");
  const value = Number(`${whole || "0"}.${decimal?.[1] ?? "00"}`);
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}

/** What browsing needs from a card: its filters (or, for older data, its colour swatches as a Colour filter). */
export function browsablePublicProduct(product: PublicProduct): BrowsableProduct {
  const swatchColours = (product.swatches ?? []).map((swatch) => swatch.label);
  const filters = product.filters?.length ? product.filters : swatchColours.length ? [{ name: "Colour", values: swatchColours }] : [];
  return { name: product.name, priceMinor: productPriceMinor(product), available: product.available !== false, filters };
}

const toMinor = (value: string) => {
  if (value.trim() === "") return undefined;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) : undefined;
};

/** The toolbar choices as a catalogue query (the older `colours` list is the Colour filter). */
export function listQuery(sort: ProductListSort, filters: ProductListFilters, filterNames: readonly string[] = []): CatalogQuery {
  const values: Record<string, string[]> = { ...(filters.values ?? {}) };
  if (filters.colours.length) values.colour = [...new Set([...(values.colour ?? []), ...filters.colours])];
  return { sort, inStock: filters.inStock, minPriceMinor: toMinor(filters.min), maxPriceMinor: toMinor(filters.max), filters: values, filterNames };
}

/** Sorts and filters a product list the way the toolbar does (also used by tests). */
export function browseProducts(products: readonly PublicProduct[], sort: ProductListSort, filters: ProductListFilters): PublicProduct[] {
  return allPages(products, sort, filters);
}

/** Every matching product (the shared rules hand out at most 48 at a time). */
function allPages(products: readonly PublicProduct[], sort: ProductListSort, filters: ProductListFilters): PublicProduct[] {
  const items: PublicProduct[] = [];
  for (let offset = 0; offset < products.length; offset += 48) items.push(...browseCatalog(products, browsablePublicProduct, { ...listQuery(sort, filters), offset, limit: 48 }).items);
  return items;
}

export type ProductListLayout = "grid" | "sidebar" | "chips" | "editorial";
export const PRODUCT_LIST_LAYOUTS: readonly ProductListLayout[] = ["grid", "sidebar", "chips", "editorial"];

/** A photo with a short story, shown between products (editorial layout). `position` is the product it follows. */
export interface StoryTile { id: string; heading: string; text?: string; imageUrl?: string; imageAlt?: string; href?: string | null; linkLabel?: string; position: number }

type ListItem = { kind: "product"; product: PublicProduct } | { kind: "story"; story: StoryTile };

/** The products with each story tile after its product number; tiles past the end of the list go last. */
export function withStories(products: readonly PublicProduct[], stories: readonly StoryTile[]): ListItem[] {
  const ordered = [...stories].sort((a, b) => a.position - b.position);
  const items: ListItem[] = [];
  products.forEach((product, index) => {
    if (index === 0) for (const story of ordered.filter((entry) => entry.position <= 0)) items.push({ kind: "story", story });
    items.push({ kind: "product", product });
    for (const story of ordered.filter((entry) => entry.position === index + 1)) items.push({ kind: "story", story });
  });
  for (const story of ordered.filter((entry) => entry.position > products.length)) items.push({ kind: "story", story });
  return items;
}

function StoryTileCard({ story }: { story: StoryTile }) {
  return <article className="jelly-story-tile">
    {/* Merchant media URLs may be served by the local API and are not Next Image assets. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {story.imageUrl && <img src={story.imageUrl} alt={story.imageAlt ?? ""} loading="lazy" decoding="async" />}
    <div className="jelly-story-tile-body">
      <h3>{story.heading}</h3>
      {story.text && <p>{story.text}</p>}
      {story.href && <a className="jelly-button jelly-button--link" href={story.href}>{story.linkLabel || "Read more"}<span className="jelly-visually-hidden">: {story.heading}</span></a>}
    </div>
  </article>;
}

function activeFilterCount(filters: ProductListFilters): number {
  const values = Object.values(filters.values ?? {}).reduce((sum, list) => sum + list.length, 0);
  return (filters.inStock ? 1 : 0) + (filters.min.trim() ? 1 : 0) + (filters.max.trim() ? 1 : 0) + filters.colours.length + values;
}

/** Waits until typing stops (price boxes) before asking the store for a new page. */
function useSettled<T>(value: T, delay: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return settled;
}

const countText = (count: number) => count === 1 ? "1 product" : `${count} products`;

/**
 * A product list with a toolbar: result count, sort, filters (availability, price, and every product option or tag
 * group with how many products each value has) and a "Show more" button that adds a page at a time.
 *
 * Without `remote` it works on the products the page already has (editor, theme preview). With `remote` (the live
 * store) the store's backend filters, counts, sorts and pages, so the browser only receives the products it shows;
 * the page's own products are drawn until the first answer arrives, and stay if the backend cannot be reached.
 */
export function ProductListBrowser({ products, columns, pageSize, showSort, showFilters, emptyMessage, cardProps, layout = "grid", stories = [], filterNames = [], remote, address }: {
  products: readonly PublicProduct[];
  columns: number;
  /** Products shown at first, and added by each "Show more". */
  pageSize: number;
  showSort: boolean;
  showFilters: boolean;
  emptyMessage: string;
  cardProps?: (product: PublicProduct, index: number) => Record<string, string> | undefined;
  /** Collection layouts (template programme L1 editorial, L2 sidebar, L3 chips). */
  layout?: ProductListLayout;
  /** Story tiles placed between products in the editorial layout. */
  stories?: readonly StoryTile[];
  /** Filters to offer, by name and in this order (section setting); empty offers every filter with two or more values. */
  filterNames?: readonly string[];
  /** Asks the store's backend for one page of the list (live store only). */
  remote?: (query: CatalogQuery) => Promise<CatalogBrowsePage>;
  /** The page address: the first sort and filters come from it, and every change is written back (live store only). */
  address?: ListAddress;
}) {
  const id = useId();
  // A shared or reloaded address opens the list with its sort and filters already chosen (drawn on the server too).
  const [initial] = useState(() => address ? readListAddress(address.search) : undefined);
  const [sort, setSort] = useState<ProductListSort>(initial?.sort ?? "featured");
  const [filters, setFilters] = useState<ProductListFilters>(initial?.filters ?? NO_FILTERS);
  useEffect(() => {
    address?.update((current) => writeListAddress(current, sort, filters));
  }, [address, sort, filters]);
  const [open, setOpen] = useState(false);
  // Pages shown so far; a new sort or filter starts again from the first page.
  const [paging, setPaging] = useState({ key: "", pages: 1 });
  const size = Math.max(1, pageSize);
  const namesKey = filterNames.join("|");
  const query = useMemo(() => listQuery(sort, filters, namesKey ? namesKey.split("|") : []), [sort, filters, namesKey]);
  const queryKey = JSON.stringify(query);
  const pages = paging.key === queryKey ? paging.pages : 1;

  // In the browser: the whole list is here, so filter it directly.
  const local = useMemo(() => browseCatalog(products, browsablePublicProduct, { ...JSON.parse(queryKey) as CatalogQuery, offset: 0, limit: Math.min(48, size * pages) }), [products, queryKey, size, pages]);
  const localShown = useMemo(() => size * pages <= 48 ? local.items : allPages(products, sort, filters).slice(0, size * pages), [local, products, sort, filters, size, pages]);

  // On the live store: one page at a time from the backend. Price typing waits 400ms before asking.
  const settledKey = useSettled(queryKey, remote ? 400 : 0);
  const [remoteState, setRemoteState] = useState<{ key: string; page: CatalogBrowsePage; items: PublicProduct[] }>();
  const [loadingMore, setLoadingMore] = useState(false);
  useEffect(() => {
    if (!remote) return;
    let active = true;
    void remote({ ...JSON.parse(settledKey) as CatalogQuery, offset: 0, limit: Math.min(48, size) }).then((page) => {
      if (active) setRemoteState({ key: settledKey, page, items: page.products });
    }).catch(() => { /* keep showing the page's own products */ });
    return () => { active = false; };
  }, [remote, settledKey, size]);
  const live = remote && remoteState?.key === settledKey ? remoteState : undefined;
  async function showMore() {
    if (!live || !remote) { setPaging({ key: queryKey, pages: pages + 1 }); return; }
    setLoadingMore(true);
    try {
      const page = await remote({ ...JSON.parse(live.key) as CatalogQuery, offset: live.items.length, limit: Math.min(48, size) });
      setRemoteState((current) => current && current.key === live.key ? { ...current, page, items: [...current.items, ...page.products.filter((item) => !current.items.some((known) => known.id === item.id))] } : current);
    } catch { /* the button stays; the shopper can try again */ }
    finally { setLoadingMore(false); }
  }

  const shown = live ? live.items : localShown;
  const total = live ? live.page.total : local.total;
  const facets: CatalogFacet[] = live ? live.page.facets : local.facets;
  const hasAvailability = products.some((product) => typeof product.available === "boolean") || Boolean(live);
  const active = activeFilterCount(filters);
  const panelId = `${id}-filters`;
  const count = shown.length < total ? `Showing ${shown.length} of ${countText(total)}` : countText(total);
  const chosen = (key: string) => (filters.values ?? {})[key] ?? (key === "colour" ? filters.colours : []);
  const toggleValue = (key: string, value: string) => setFilters((current) => {
    const values = { ...(current.values ?? {}) };
    const list = values[key] ?? (key === "colour" ? current.colours : []);
    const next = list.some((item) => item.toLowerCase() === value.toLowerCase()) ? list.filter((item) => item.toLowerCase() !== value.toLowerCase()) : [...list, value];
    values[key] = next;
    return { ...current, colours: key === "colour" ? [] : current.colours, values };
  });
  const isChosen = (key: string, value: string) => chosen(key).some((item) => item.toLowerCase() === value.toLowerCase());
  const chips = layout === "chips" && showFilters;
  const chipFacets = facets.slice(0, 2);
  const items = layout === "editorial" ? withStories(shown, stories) : shown.map((product) => ({ kind: "product" as const, product }));
  const clear = () => setFilters(NO_FILTERS);
  return <div className="jelly-list-browser" data-layout={layout === "grid" ? undefined : layout} data-filters={showFilters ? "true" : undefined} data-filters-open={showFilters && open ? "true" : undefined} aria-busy={remote && !live ? true : undefined}>
    <div className="jelly-list-toolbar">
      {showFilters && !chips && <button type="button" className="jelly-list-filter-toggle" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((value) => !value)}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" focusable="false"><path d="M2 4h14M5 9h8M7.5 14h3" strokeLinecap="round" /></svg>
        <span>Filter{active ? ` (${active})` : ""}</span>
      </button>}
      <p className="jelly-list-count" role="status" aria-live="polite">{count}</p>
      {showSort && <label className="jelly-list-sort"><span>Sort by</span>
        <select value={sort} onChange={(event) => setSort(event.currentTarget.value as ProductListSort)}>{PRODUCT_LIST_SORTS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
      </label>}
    </div>
    {chips && <div className="jelly-list-chips" role="group" aria-label="Filters">
      {hasAvailability && <button type="button" className="jelly-list-chip" aria-pressed={filters.inStock} onClick={() => setFilters((current) => ({ ...current, inStock: !current.inStock }))}>In stock</button>}
      {chipFacets.flatMap((facet) => facet.values.map((value) => <button key={`${facet.key}:${value.value}`} type="button" className="jelly-list-chip" aria-pressed={isChosen(facet.key, value.value)} disabled={value.count === 0 && !isChosen(facet.key, value.value)} onClick={() => toggleValue(facet.key, value.value)}>{value.value}</button>))}
      {active > 0 && <button type="button" className="jelly-list-clear" onClick={clear}>Clear all</button>}
    </div>}
    {showFilters && !chips && <div className="jelly-list-filters" id={panelId} role="group" aria-label="Filters">
      {hasAvailability && <fieldset><legend>Availability</legend>
        <label className="jelly-list-check"><input type="checkbox" checked={filters.inStock} onChange={(event) => { const checked = event.currentTarget.checked; setFilters((current) => ({ ...current, inStock: checked })); }} /><span>In stock only</span></label>
      </fieldset>}
      <fieldset><legend>Price</legend>
        <div className="jelly-list-price">
          <label><span>From</span><input type="number" inputMode="decimal" min="0" step="1" value={filters.min} placeholder="0" onChange={(event) => { const value = event.currentTarget.value; setFilters((current) => ({ ...current, min: value })); }} /></label>
          <label><span>To</span><input type="number" inputMode="decimal" min="0" step="1" value={filters.max} placeholder="Any" onChange={(event) => { const value = event.currentTarget.value; setFilters((current) => ({ ...current, max: value })); }} /></label>
        </div>
      </fieldset>
      {facets.map((facet) => <fieldset key={facet.key} data-filter={filterKey(facet.label)}><legend>{facet.label}</legend>
        <div className="jelly-list-values">{facet.values.map((value) => {
          const checked = isChosen(facet.key, value.value);
          return <label key={value.value} className="jelly-list-check" data-empty={value.count === 0 && !checked ? "true" : undefined}>
            <input type="checkbox" checked={checked} disabled={value.count === 0 && !checked} onChange={() => toggleValue(facet.key, value.value)} />
            <span>{value.value}</span><span className="jelly-list-value-count" aria-label={countText(value.count)}>({value.count})</span>
          </label>;
        })}</div>
      </fieldset>)}
      {active > 0 && <button type="button" className="jelly-list-clear" onClick={clear}>Clear all</button>}
    </div>}
    <div className="jelly-list-results">
      {shown.length
        ? <div className="jelly-product-grid-items" data-testid="collection-product-grid-items" data-columns={columns} style={{ "--jelly-columns": columns } as CSSProperties}>{items.map((item) => item.kind === "story"
          ? <StoryTileCard key={`story-${item.story.id}`} story={item.story} />
          : <ProductCard key={item.product.id} product={item.product} editorProps={cardProps?.(item.product, shown.indexOf(item.product))} />)}</div>
        : <div className="jelly-empty-state"><p>{active ? "No products match these filters." : emptyMessage}</p>{active > 0 && <button type="button" className="jelly-list-clear" onClick={clear}>Clear filters</button>}</div>}
      {shown.length < total && <div className="jelly-list-more">
        <button type="button" className="jelly-button jelly-button--secondary" disabled={loadingMore} onClick={() => void showMore()}>{loadingMore ? "Loading…" : "Show more products"}</button>
      </div>}
    </div>
  </div>;
}
