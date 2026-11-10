
import { ProductCard } from "../product-card";
import { useId, useMemo, useState, type CSSProperties } from "react";
import type { PublicProduct } from "../types";

export type ProductListSort = "featured" | "price-asc" | "price-desc" | "name-asc";

export const PRODUCT_LIST_SORTS: ReadonlyArray<{ value: ProductListSort; label: string }> = [
  { value: "featured", label: "Featured" },
  { value: "price-asc", label: "Price, low to high" },
  { value: "price-desc", label: "Price, high to low" },
  { value: "name-asc", label: "Name, A to Z" },
];

export interface ProductListFilters { inStock: boolean; min: string; max: string; colours: string[] }
const NO_FILTERS: ProductListFilters = { inStock: false, min: "", max: "", colours: [] };

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

/** Sorts and filters a product list the way the toolbar does (also used by tests). */
export function browseProducts(products: readonly PublicProduct[], sort: ProductListSort, filters: ProductListFilters): PublicProduct[] {
  const min = filters.min.trim() === "" ? undefined : Math.round(Number(filters.min) * 100);
  const max = filters.max.trim() === "" ? undefined : Math.round(Number(filters.max) * 100);
  const colours = new Set(filters.colours);
  const kept = products.filter((product) => {
    const price = productPriceMinor(product);
    if (filters.inStock && product.available === false) return false;
    if (min !== undefined && Number.isFinite(min) && price < min) return false;
    if (max !== undefined && Number.isFinite(max) && price > max) return false;
    if (colours.size && !(product.swatches ?? []).some((swatch) => colours.has(swatch.label))) return false;
    return true;
  });
  if (sort === "featured") return kept;
  const sorted = [...kept];
  if (sort === "name-asc") sorted.sort((a, b) => a.name.localeCompare(b.name));
  else sorted.sort((a, b) => sort === "price-asc" ? productPriceMinor(a) - productPriceMinor(b) : productPriceMinor(b) - productPriceMinor(a));
  return sorted;
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
  return (filters.inStock ? 1 : 0) + (filters.min.trim() ? 1 : 0) + (filters.max.trim() ? 1 : 0) + filters.colours.length;
}

/**
 * A product list with a toolbar: result count, sort and filters for availability, price and colour, and a
 * "Show more" button that adds a page of products at a time. It works on the products the page already has (the
 * storefront loads the store's whole catalogue), so it behaves the same in the editor preview and the live store.
 * Sort and filters are on unless the merchant turns them off; with both off the toolbar shows the count only.
 */
export function ProductListBrowser({ products, columns, pageSize, showSort, showFilters, emptyMessage, cardProps, layout = "grid", stories = [] }: {
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
}) {
  const id = useId();
  const [sort, setSort] = useState<ProductListSort>("featured");
  const [filters, setFilters] = useState<ProductListFilters>(NO_FILTERS);
  const [open, setOpen] = useState(false);
  // Pages shown so far; a new sort or filter starts again from the first page.
  const [paging, setPaging] = useState({ key: "", pages: 1 });
  const pagingKey = JSON.stringify([sort, filters]);
  const pages = paging.key === pagingKey ? paging.pages : 1;
  const matching = useMemo(() => browseProducts(products, sort, filters), [products, sort, filters]);
  const shown = useMemo(() => matching.slice(0, Math.max(1, pageSize) * pages), [matching, pageSize, pages]);
  const colourOptions = useMemo(() => [...new Set(products.flatMap((product) => (product.swatches ?? []).map((swatch) => swatch.label)))].slice(0, 12), [products]);
  const hasAvailability = products.some((product) => typeof product.available === "boolean");
  const active = activeFilterCount(filters);
  const panelId = `${id}-filters`;
  const total = matching.length === 1 ? "1 product" : `${matching.length} products`;
  const count = shown.length < matching.length ? `Showing ${shown.length} of ${total}` : total;
  const toggleColour = (label: string) => setFilters((current) => ({ ...current, colours: current.colours.includes(label) ? current.colours.filter((item) => item !== label) : [...current.colours, label] }));
  const chips = layout === "chips" && showFilters;
  const items = layout === "editorial" ? withStories(shown, stories) : shown.map((product) => ({ kind: "product" as const, product }));
  return <div className="jelly-list-browser" data-layout={layout === "grid" ? undefined : layout} data-filters={showFilters ? "true" : undefined} data-filters-open={showFilters && open ? "true" : undefined}>
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
      {colourOptions.map((label) => <button key={label} type="button" className="jelly-list-chip" aria-pressed={filters.colours.includes(label)} onClick={() => toggleColour(label)}>{label}</button>)}
      {active > 0 && <button type="button" className="jelly-list-clear" onClick={() => setFilters(NO_FILTERS)}>Clear all</button>}
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
      {colourOptions.length > 0 && <fieldset><legend>Colour</legend>
        <div className="jelly-list-colours">{colourOptions.map((label) => <label key={label} className="jelly-list-check"><input type="checkbox" checked={filters.colours.includes(label)} onChange={() => toggleColour(label)} /><span>{label}</span></label>)}</div>
      </fieldset>}
      {active > 0 && <button type="button" className="jelly-list-clear" onClick={() => setFilters(NO_FILTERS)}>Clear all</button>}
    </div>}
    <div className="jelly-list-results">
      {shown.length
        ? <div className="jelly-product-grid-items" data-testid="collection-product-grid-items" data-columns={columns} style={{ "--jelly-columns": columns } as CSSProperties}>{items.map((item, index) => item.kind === "story"
          ? <StoryTileCard key={`story-${item.story.id}`} story={item.story} />
          : <ProductCard key={item.product.id} product={item.product} editorProps={cardProps?.(item.product, shown.indexOf(item.product))} />)}</div>
        : <div className="jelly-empty-state"><p>{active ? "No products match these filters." : emptyMessage}</p>{active > 0 && <button type="button" className="jelly-list-clear" onClick={() => setFilters(NO_FILTERS)}>Clear filters</button>}</div>}
      {shown.length < matching.length && <div className="jelly-list-more">
        <button type="button" className="jelly-button jelly-button--secondary" onClick={() => setPaging({ key: pagingKey, pages: pages + 1 })}>Show more products</button>
      </div>}
    </div>
  </div>;
}
