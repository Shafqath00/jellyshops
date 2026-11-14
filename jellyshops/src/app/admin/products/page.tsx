"use client";
import Link from "next/link";
import { ImageIcon, Package } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/features/auth/providers/auth-provider";
import { AdminPage, Banner, ConfirmDialog, EmptyState, IndexTable, Picker, StatusBadge, useToast, type IndexColumn, type IndexTab } from "@/components/admin";
import { useAdminCatalog, type CatalogAdminProduct, type CatalogPage, type CollectionRow } from "@/features/admin/api/catalog-api";

import { ProductSurface } from "@/features/product-builder/product-surface";
import { ProductRowActions } from "@/features/product-builder/product-row-actions";
import { useProductBulkApi } from "@/features/product-bulk/api";
import { BulkEditDialog } from "@/features/product-bulk/bulk-edit-dialog";
import { ExportDialog } from "@/features/product-bulk/export-dialog";

type ProductStatus = CatalogAdminProduct["status"];
const TABS: IndexTab[] = [{ id: "", label: "All" }, { id: "ACTIVE", label: "Active" }, { id: "DRAFT", label: "Draft" }, { id: "ARCHIVED", label: "Archived" }];
const SORTS = [{ value: "title-asc", label: "Name A–Z" }, { value: "newest", label: "Newest first" }, { value: "price-asc", label: "Price, low to high" }, { value: "price-desc", label: "Price, high to low" }];
const STATUS_WORDS: Record<ProductStatus, string> = { ACTIVE: "active", DRAFT: "draft", ARCHIVED: "archived" };
type Facets = { productTypes: string[]; vendors: string[]; tags: string[] };
type Filters = { productType: string; vendor: string; tag: string; collectionId: string; available: string };
const NO_FILTERS: Filters = { productType: "", vendor: "", tag: "", collectionId: "", available: "" };

/** One filter dropdown; left out when the store has nothing to choose from. */
function FilterSelect({ label, all, value, options, onChange }: { label: string; all: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  if (!options.length) return null;
  return <label><span className="sr-only">{label}</span><select className="jk-select" value={value} onChange={(event) => onChange(event.target.value)}><option value="">{all}</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}

/** "40 in stock for 4 variants", or "Not tracked" when no variant counts stock. */
function stockSummary(product: CatalogAdminProduct) {
  const tracked = product.variants.filter((variant) => variant.trackInventory !== false);
  if (!tracked.length) return { text: "Not tracked", low: false };
  const stock = tracked.reduce((sum, variant) => sum + Math.max(0, (variant.quantity ?? 0) - (variant.reserved ?? 0)), 0);
  const variants = product.variants.length > 1 ? ` for ${product.variants.length} variants` : "";
  return { text: `${stock} in stock${variants}`, low: stock === 0 };
}

export default function ProductsPage() {
  const { request, all, ready, storeId } = useAdminCatalog(), { activeStore } = useAuth();
  const [collectionFor, setCollectionFor] = useState<string[] | null>(null);
  const [collections, setCollections] = useState<CollectionRow[]>([]);
  const toast = useToast();
  const [rowBusy, setRowBusy] = useState("");
  const [rowError, setRowError] = useState("");
  const [archiveTarget, setArchiveTarget] = useState<CatalogAdminProduct | null>(null);
  const [archiveMany, setArchiveMany] = useState<string[] | null>(null);
  const bulkApi = useProductBulkApi();
  /** null = closed; an empty list = opened from the page header (no rows ticked). */
  const [exporting, setExporting] = useState<string[] | null>(null);
  const [editing, setEditing] = useState<string[] | null>(null);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [facets, setFacets] = useState<Facets>({ productTypes: [], vendors: [], tags: [] });
  const returnFocus = useRef<HTMLElement | null>(null);
  const rememberFocus = (product?: CatalogAdminProduct) => {
    returnFocus.current = product
      ? [...document.querySelectorAll<HTMLButtonElement>("button[data-product-actions]")].find(button => button.dataset.productActions === product.id) ?? null
      : document.activeElement as HTMLElement;
  };
  const restoreFocus = (event: Event) => {
    event.preventDefault();
    const target = returnFocus.current?.isConnected ? returnFocus.current : document.querySelector<HTMLElement>('.product-surface a[href="/admin/products/new"]');
    target?.focus();
  };
  async function rowStatus(product: CatalogAdminProduct, status: ProductStatus) {
    setRowBusy(product.id); setRowError("");
    try { await setStatusFor([product.id], status); }
    catch (error) { setRowError(error instanceof Error ? error.message : "Could not update this product."); }
    finally { setRowBusy(""); }
  }
  const [rows, setRows] = useState<CatalogAdminProduct[]>([]), [query, setQuery] = useState(""), [search, setSearch] = useState(""), [status, setStatus] = useState(""), [sort, setSort] = useState("title-asc");
  const [cursor, setCursor] = useState<string | null>(null), [history, setHistory] = useState<Array<string | null>>([]), [next, setNext] = useState<string | null>(null);
  const [error, setError] = useState(""), [loading, setLoading] = useState(true), [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    if (!ready) return;
    void Promise.resolve().then(() => { if (active) setLoading(true); });
    const params = new URLSearchParams({ limit: "50", sort });
    if (search.trim()) params.set("query", search.trim());
    if (status) params.set("status", status);
    if (cursor) params.set("cursor", cursor);
    for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
    void request<CatalogPage<CatalogAdminProduct>>("/products?" + params)
      .then((page) => { if (active) { setRows(page.nodes); setNext(page.nextCursor); setError(""); } })
      .catch((failure: Error) => { if (active) setError(failure.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [request, ready, storeId, search, status, sort, cursor, revision, filters]);
  // What the filters can offer. A backend without the lookup, or a failed request, just leaves those filters out.
  useEffect(() => {
    let active = true;
    if (!ready) return;
    void Promise.resolve(request<Facets>("/products/facets")).then((found) => { if (active && Array.isArray(found?.productTypes) && Array.isArray(found.vendors) && Array.isArray(found.tags)) setFacets(found); }).catch(() => undefined);
    void Promise.resolve(all<CollectionRow>("/collections")).then((rows) => { if (active && Array.isArray(rows)) setCollections(rows); }).catch(() => undefined);
    return () => { active = false; };
  }, [request, all, ready, storeId, revision]);
  const reset = () => { setCursor(null); setHistory([]); };
  const filter = (key: keyof Filters, value: string) => { setFilters((current) => ({ ...current, [key]: value })); reset(); };
  const filterCount = Object.values(filters).filter(Boolean).length;
  const words = (values: string[]) => values.map((value) => ({ value, label: value }));
  const currency = activeStore?.currency ?? "GBP";
  const money = useCallback((minor: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(minor / 100), [currency]);
  const saveProduct = useCallback((productId: string, body: Record<string, unknown>) => request(`/products/${encodeURIComponent(productId)}`, { method: "PATCH", body: JSON.stringify(body) }), [request]);
  async function setStatusFor(ids: string[], value: ProductStatus) {
    const results = await Promise.allSettled(ids.map((id) => request(`/products/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ status: value }) })));
    const failed = results.filter((result) => result.status === "rejected").length;
    setRevision((n) => n + 1);
    if (failed) throw new Error(`${failed} of ${ids.length} products could not be changed. Try again.`);
    toast(`${ids.length} ${ids.length === 1 ? "product" : "products"} set to ${STATUS_WORDS[value]}`);
  }
  const loadCollections = useCallback(async (query: string) => {
    const rows = await all<CollectionRow>("/collections");
    setCollections(rows);
    return rows.filter((row) => row.title.toLowerCase().includes(query.toLowerCase())).map((row) => ({ id: row.id, label: row.title, detail: `${row.productIds.length} ${row.productIds.length === 1 ? "product" : "products"}` }));
  }, [all]);
  async function addToCollection(ids: string[], collectionId: string) {
    const collection = collections.find((row) => row.id === collectionId);
    if (!collection) return;
    const productIds = [...new Set([...collection.productIds, ...ids])];
    try {
      await request(`/collections/${encodeURIComponent(collectionId)}`, { method: "PATCH", body: JSON.stringify({ productIds }) });
      toast(`${ids.length} ${ids.length === 1 ? "product" : "products"} added to ${collection.title}`);
    } catch (failure) { toast(failure instanceof Error ? failure.message : "Could not update the collection.", { tone: "critical" }); }
  }
  const columns: IndexColumn<CatalogAdminProduct>[] = [
    { id: "product", header: "Product", mobile: "primary", cell: (product) => <Link href={"/admin/products/" + product.id} className="product-name">
      {product.media[0] ? <img src={product.media[0].url} alt="" width={40} height={40} className="jk-thumb" /> : <span className="jk-thumb"><ImageIcon size={17} aria-hidden="true" /></span>}<span>{product.title}</span></Link> },
    { id: "status", header: "Status", cell: (product) => <StatusBadge kind="product" value={product.status} /> },
    { id: "stock", header: "Inventory", cell: (product) => { const stock = stockSummary(product); const [quantity, variants] = stock.text.split(" for "); return <span className={`product-inventory ${stock.low ? "text-[var(--jk-critical-text)]" : ""}`}><span>{quantity}</span>{variants && <small>{variants}</small>}</span>; } },
    { id: "price", header: "Price", align: "end", cell: (product) => <span className="tabular-nums">{money(product.variants[0]?.priceMinor ?? 0)}</span> },
    { id: "type", header: "Type", mobile: "hidden", cell: (product) => product.productType || <span className="jk-muted">None</span> },
    { id: "vendor", header: "Brand or supplier", mobile: "hidden", cell: (product) => product.vendor || <span className="jk-muted">None</span> },
    { id: "actions", header: "Actions", align: "end", cell: product => <ProductRowActions product={product} busy={rowBusy === product.id} onStatus={status => void rowStatus(product, status)} onArchive={() => { rememberFocus(product); setArchiveTarget(product); }} onCollection={() => { rememberFocus(product); setCollectionFor([product.id]); }} /> },
  ];
  const filtered = Boolean(search || status || filterCount);
  return <ProductSurface><AdminPage title="Products" description="Manage your products, pricing, and availability." primaryAction={{ label: "Add product", href: "/admin/products/new" }}
    secondaryActions={[{ label: "Import", href: "/admin/products/import" }, { label: "Export", onAction: () => { rememberFocus(); setExporting([]); } }]}
    moreActions={[{ label: "Add photos in bulk", href: "/admin/products/photos" }]}>
    {rowError && <Banner tone="critical" title="Product not updated" onDismiss={() => setRowError("")}>{rowError}</Banner>}
    <IndexTable
      label="Products"
      rows={rows}
      rowKey={(product) => product.id}
      rowLabel={(product) => product.title}
      columns={columns}
      loading={loading}
      error={error}
      onRetry={() => setRevision((n) => n + 1)}
      tabs={TABS}
      activeTab={status}
      onTabChange={(value) => { setStatus(value); reset(); }}
      search={{ value: query, onChange: setQuery, label: "Search products", placeholder: "Search by name or SKU", onSubmit: () => { setSearch(query); reset(); } }}
      filters={<>
        <FilterSelect label="Filter by type" all="All types" value={filters.productType} options={words(facets.productTypes)} onChange={(value) => filter("productType", value)} />
        <FilterSelect label="Filter by brand or supplier" all="All brands" value={filters.vendor} options={words(facets.vendors)} onChange={(value) => filter("vendor", value)} />
        <FilterSelect label="Filter by collection" all="All collections" value={filters.collectionId} options={collections.map((row) => ({ value: row.id, label: row.title }))} onChange={(value) => filter("collectionId", value)} />
        <FilterSelect label="Filter by tag" all="All tags" value={filters.tag} options={words(facets.tags)} onChange={(value) => filter("tag", value)} />
        <FilterSelect label="Filter by stock" all="Any stock" value={filters.available} options={[{ value: "true", label: "In stock" }, { value: "false", label: "Out of stock" }]} onChange={(value) => filter("available", value)} />
        {filterCount > 0 && <button type="button" className="jk-button jk-button-plain" onClick={() => { setFilters(NO_FILTERS); reset(); }}>Clear filters</button>}
        <label><span className="sr-only">Sort products</span><select className="jk-select" value={sort} onChange={(event) => { setSort(event.target.value); reset(); }}>{SORTS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      </>}
      bulkActions={[
        { label: "Bulk edit", onAction: (ids) => { rememberFocus(); setEditing(ids); } },
        { label: "Export", onAction: (ids) => { rememberFocus(); setExporting(ids); } },
        { label: "Set as active", onAction: (ids) => setStatusFor(ids, "ACTIVE") },
        { label: "Set as draft", onAction: (ids) => setStatusFor(ids, "DRAFT") },
        { label: "Archive", destructive: true, onAction: (ids) => { rememberFocus(); setArchiveMany(ids); } },
        { label: "Add to collection", onAction: (ids) => { rememberFocus(); setCollectionFor(ids); } },
      ]}
      emptyState={filtered
        ? <EmptyState icon={Package} title="No matching products" description="Try another search, clear the filters, or choose All to see every product." action={filterCount > 0 ? <button type="button" className="jk-button" onClick={() => { setFilters(NO_FILTERS); reset(); }}>Clear filters</button> : undefined} />
        : <EmptyState icon={Package} title="Add your first product" description="Give customers something to discover in your store. Add them one at a time, or bring a whole list in from a spreadsheet." action={<Link href="/admin/products/new" className="jk-button jk-button-primary">Add product</Link>} secondaryAction={<Link href="/admin/products/import" className="jk-button">Import from a spreadsheet</Link>} />}
      pagination={{
        hasPrevious: history.length > 0,
        hasNext: Boolean(next),
        onPrevious: () => { setCursor(history.at(-1) ?? null); setHistory((current) => current.slice(0, -1)); },
        onNext: () => { setHistory((current) => [...current, cursor]); setCursor(next); },
      }}
    />
    <ConfirmDialog open={Boolean(archiveTarget)} onOpenChange={open => { if (!open) setArchiveTarget(null); }} title={`Archive ${archiveTarget?.title ?? "product"}?`} description="This product will be hidden from your store. You can make it active again later." confirmLabel="Archive product" destructive className="product-overlay" overlayClassName="product-backdrop" onCloseAutoFocus={restoreFocus} onConfirm={async () => { if (archiveTarget) await setStatusFor([archiveTarget.id], "ARCHIVED"); }} />
    <ConfirmDialog open={Boolean(archiveMany)} onOpenChange={open => { if (!open) setArchiveMany(null); }} title={`Archive ${archiveMany?.length ?? 0} ${archiveMany?.length === 1 ? "product" : "products"}?`} description="They will be hidden from your store. You can make them active again later from the Archived tab." confirmLabel="Archive products" destructive className="product-overlay" overlayClassName="product-backdrop" onCloseAutoFocus={restoreFocus} onConfirm={async () => { if (archiveMany) await setStatusFor(archiveMany, "ARCHIVED"); }} />
    <ExportDialog open={exporting !== null} onOpenChange={(open) => { if (!open) setExporting(null); }} api={bulkApi} selectedIds={exporting ?? []} filters={{ query: search.trim(), status, ...filters }} className="product-overlay" overlayClassName="product-backdrop" />
    {editing !== null && <BulkEditDialog open onOpenChange={(open) => { if (!open) setEditing(null); }} products={rows.filter((product) => editing.includes(product.id))} collections={collections.map((row) => ({ id: row.id, title: row.title }))} money={money} save={saveProduct} onDone={() => setRevision((n) => n + 1)} className="product-overlay" overlayClassName="product-backdrop" />}
    <Picker className="product-overlay" overlayClassName="product-backdrop" onCloseAutoFocus={restoreFocus} open={collectionFor !== null} onOpenChange={(open) => { if (!open) setCollectionFor(null); }} title="Add to collection" searchLabel="Search collections" multiple={false} doneLabel="Add products"
      load={loadCollections} onDone={(picked) => { const ids = collectionFor ?? []; if (picked[0]) void addToCollection(ids, picked[0].id); }} />
  </AdminPage></ProductSurface>;
}
