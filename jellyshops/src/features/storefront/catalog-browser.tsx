"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useShop } from "@/contexts/shop-context";
import type { Product } from "@/lib/domain";
import { formatMoney } from "@/lib/domain";
import { catalogProductToStorefrontProduct, type PublicCatalogResponse } from "@/features/commerce/api/client";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { WishlistButton } from "@/features/customers/wishlist-button";

function QuickView({ product, storeSlug, onClose }: { product: Product; storeSlug: string; onClose(): void }) {
  const { repository } = useShop(); const store = repository.getStoreBySlug(storeSlug)!;
  const [variantId, setVariantId] = useState(product.variants[0]?.id ?? ""); const [message, setMessage] = useState<string>();
  const variant = product.variants.find((item) => item.id === variantId);
  const configured = Boolean(product.options?.length);
  const canBuy = product.published && !product.archived && variant && variant.stock > 0 && !configured;
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}><DialogContent className="max-h-[90dvh] overflow-auto"><DialogTitle>{product.name}</DialogTitle><DialogDescription>{product.description || "Product details"}</DialogDescription><div className="signature-quick-view"><img src={product.imageUrl} alt={product.name} width={400} height={400} /><p>{variant ? formatMoney(variant.priceMinor, store.currency) : "Currently unavailable"}</p>{product.variants.length > 1 && <label>Variant<select value={variantId} onChange={(event) => { setVariantId(event.target.value); setMessage(undefined); }}>{product.variants.map((item) => <option key={item.id} value={item.id}>{item.name}{item.stock <= 0 ? " — out of stock" : ""}</option>)}</select></label>}{configured ? <p>Choose your customization on the product page.</p> : <button type="button" className="signature-primary" disabled={!canBuy} onClick={() => { if (!variant || !canBuy) return; const cart = repository.getCartForStore(storeSlug) ?? repository.createCart(storeSlug); const current = cart.items.find((item) => item.variantId === variant.id && !(item.configurationSelections?.length)); repository.updateCartItem(cart.id, variant.id, Math.min((current?.quantity ?? 0) + 1, variant.stock), [], variant.priceMinor); setMessage("Added to your bag."); }}>Add to bag</button>}{message && <p role="status">{message}</p>}<Link className="signature-secondary" href={`/${storeSlug}/products/${product.slug}`}>View full details</Link><WishlistButton storeId={store.id} productId={product.id} /></div></DialogContent></Dialog>;
}

export function CatalogBrowser({ storeSlug, collectionId, initialQuery = "", initialProducts }: { storeSlug: string; collectionId?: string; initialQuery?: string; initialProducts?: Product[] }) {
  const { repository, state } = useShop(); const store = repository.getStoreBySlug(storeSlug);
  const [filters, setFilters] = useState({ query: initialQuery, sort: "id", available: false, categoryId: "", minPriceMinor: "", maxPriceMinor: "" });
  const [attempt, setAttempt] = useState(0); const [more, setMore] = useState<string>(); const [quick, setQuick] = useState<Product>();
  // Themes decide whether these show: the extra filters can fold away, and products can be shown larger or smaller.
  const [filtersOpen, setFiltersOpen] = useState(false); const [density, setDensity] = useState<"standard" | "large">("standard");
  const scope = JSON.stringify([store?.id, collectionId, filters, attempt]);
  const [result, setResult] = useState<{ scope: string; products: Product[]; nextCursor: string | null; error?: string }>();
  const all = initialProducts ?? repository.listProducts(storeSlug);
  const initial = all.filter((p) => p.published && !p.archived && (!collectionId || p.collectionIds?.includes(collectionId))).sort((a, b) => a.id.localeCompare(b.id));
  const categories = [...new Map(all.filter((p) => p.primaryCategoryId).map((p) => [p.primaryCategoryId!, p.category])).entries()];
  const query = useMemo(() => {
    const params = new URLSearchParams({ limit: "12", sort: filters.sort });
    if (collectionId) params.set("collectionId", collectionId);
    if (filters.query.trim()) params.set("query", filters.query.trim());
    if (filters.categoryId) params.set("categoryId", filters.categoryId);
    if (filters.available) params.set("available", "true");
    if (filters.minPriceMinor) params.set("minPriceMinor", String(Math.round(Number(filters.minPriceMinor) * 100)));
    if (filters.maxPriceMinor) params.set("maxPriceMinor", String(Math.round(Number(filters.maxPriceMinor) * 100)));
    return params.toString();
  }, [collectionId, filters]);
  const base = `${(process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001").replace(/\/$/, "")}/api/public/stores/${encodeURIComponent(store?.id ?? "")}/catalog/products`;
  useEffect(() => {
    if (!store) return;
    const controller = new AbortController(); let active = true;
    void fetch(`${base}?${query}`, { signal: controller.signal, cache: "no-store" }).then(async (response) => { if (!response.ok) throw new Error("Unable to load products. Please retry."); const data = await response.json() as PublicCatalogResponse; if (active) setResult({ scope, products: data.nodes.map(catalogProductToStorefrontProduct), nextCursor: data.nextCursor }); }).catch((error: unknown) => { if (active) setResult({ scope, products: [], nextCursor: null, error: error instanceof Error ? error.message : "Unable to load products." }); });
    return () => { active = false; controller.abort(); };
  }, [store, base, query, scope]);
  if (!store) return null;
  const current = result?.scope === scope ? result : undefined;
  const defaultFilters = !filters.query && filters.sort === "id" && !filters.available && !filters.categoryId && !filters.minPriceMinor && !filters.maxPriceMinor;
  const products = current?.products ?? (defaultFilters ? initial.slice(0, 12) : []);
  const nextCursor = current?.nextCursor ?? (!current && defaultFilters && initial.length > 12 ? initial[11].id : null);
  async function loadMore() {
    if (!nextCursor || more === scope) return;
    setMore(scope);
    try { const response = await fetch(`${base}?${query}&cursor=${encodeURIComponent(nextCursor)}`, { cache: "no-store" }); if (!response.ok) throw new Error("Unable to load more products."); const data = await response.json() as PublicCatalogResponse; setResult((value) => value?.scope === scope ? { scope, products: [...new Map([...value.products, ...data.nodes.map(catalogProductToStorefrontProduct)].map((p) => [p.id, p])).values()], nextCursor: data.nextCursor } : value); }
    catch (error) { setResult((value) => value?.scope === scope ? { ...value, error: error instanceof Error ? error.message : "Unable to load more products." } : value); }
    finally { setMore((value) => value === scope ? undefined : value); }
  }
  const countLabel = !current && !defaultFilters ? "Loading…" : products.length === 0 ? "No products" : `${products.length}${nextCursor ? "+" : ""} ${products.length === 1 && !nextCursor ? "product" : "products"}`;
  const densityIcon = (columns: number) => <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true" focusable="false">{columns === 2 ? <><rect x="2" y="2" width="6" height="14" /><rect x="10" y="2" width="6" height="14" /></> : <><rect x="1.5" y="2" width="3" height="14" /><rect x="6" y="2" width="3" height="14" /><rect x="10.5" y="2" width="3" height="14" /><rect x="15" y="2" width="1.5" height="14" /></>}</svg>;
  return <div className="signature-catalog"><form className="signature-filters" aria-label="Filter products" data-filters-open={filtersOpen ? "true" : undefined} onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); setFilters({ query: String(data.get("query") ?? ""), sort: String(data.get("sort") ?? "id"), available: data.get("available") === "yes", categoryId: String(data.get("categoryId") ?? ""), minPriceMinor: String(data.get("min") ?? ""), maxPriceMinor: String(data.get("max") ?? "") }); }}>
    <div className="signature-toolbar">
    <button type="button" className="signature-filter-toggle" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((open) => !open)}>Filters</button>
    <p className="signature-result-count" role="status">{countLabel}</p>
    <div className="signature-view-toggle" role="group" aria-label="Product size">
      <button type="button" aria-pressed={density === "large"} aria-label="Show larger images" onClick={() => setDensity("large")}>{densityIcon(2)}</button>
      <button type="button" aria-pressed={density === "standard"} aria-label="Show more products" onClick={() => setDensity("standard")}>{densityIcon(4)}</button>
    </div>
  </div>
  <label className="signature-search">Search<input name="query" type="search" defaultValue={initialQuery} placeholder="Find something you love" maxLength={120} /></label>
    <label className="signature-sort">Sort<select name="sort" defaultValue="id" onChange={(event) => event.currentTarget.form?.requestSubmit()}><option value="id">Featured</option><option value="newest">New arrivals</option><option value="best-selling">Best sellers</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option><option value="title-asc">Name: A to Z</option></select></label>
    {categories.length > 0 && <label>Category<select name="categoryId"><option value="">All categories</option>{categories.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>}
    <label>Min price ({store.currency})<input type="number" min="0" step="0.01" name="min" /></label><label>Max price ({store.currency})<input type="number" min="0" step="0.01" name="max" /></label><label className="signature-check"><input name="available" type="checkbox" value="yes" />In stock only</label><button className="signature-primary signature-apply">Apply filters</button>
  </form>
    {current?.error && <div role="alert"><p>{current.error}</p><button className="signature-secondary" onClick={() => setAttempt((value) => value + 1)}>Retry</button></div>}
    {!current && !defaultFilters ? <p role="status">Loading products…</p> : !products.length && !current?.error ? <p>No products match these filters.</p> : null}
    <div className="signature-product-grid" data-density={density}>{products.map((product) => <article key={product.id} className="signature-card"><Link href={`/${storeSlug}/products/${product.slug}`}><div className="signature-card-image"><img src={product.imageUrl} alt={product.name} width={480} height={600} loading="lazy" /></div><h2>{product.name}</h2></Link><p className="signature-card-price">{formatMoney(product.variants[0]?.priceMinor ?? 0, store.currency)}</p><button className="signature-secondary signature-quick-view-button" onClick={() => setQuick(product)}>Quick view</button></article>)}</div>
    {nextCursor && <button className="signature-secondary" disabled={more === scope || !current} onClick={() => void loadMore()}>{more === scope ? "Loading…" : "Load more"}</button>}
    {quick && <QuickView key={quick.id} product={quick} storeSlug={storeSlug} onClose={() => setQuick(undefined)} />}<span hidden>{state.version}</span>
  </div>;
}
