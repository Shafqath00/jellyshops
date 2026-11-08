"use client";
import Link from "next/link";
import { Boxes } from "lucide-react";
import { useEffect, useState } from "react";
import { AdminPage, Banner, EmptyState, IndexTable, SaveBar, StatusBadge, useToast, useUnsavedChangesWarning, type IndexColumn, type IndexTab } from "@/components/admin";
import { useAdminCatalog, type InventoryRow, type CatalogPage } from "@/features/admin/api/catalog-api";
import { StockHistory } from "@/features/admin/components/stock-history";
import { STOCK_STATUS_LABEL } from "@/features/product-builder/stock";

const TABS: IndexTab[] = [{ id: "", label: "All" }, { id: "low", label: "Low stock" }, { id: "out", label: "Out of stock" }];
/** Why the count changed; saved in the stock history with the merchant's note. */
const REASONS = ["Received new stock", "Stock count correction", "Damaged or lost", "Returned by a customer", "Other"] as const;
const STATUS_TONE = { untracked: "neutral", out: "critical", low: "warning", in_stock: "success" } as const;

export default function InventoryPage() {
  const { request, ready, storeId } = useAdminCatalog();
  const toast = useToast();
  const [historyRow, setHistoryRow] = useState<InventoryRow | null>(null);
  const [rows, setRows] = useState<InventoryRow[]>([]), [drafts, setDrafts] = useState<Record<string, string>>({});
  const [reason, setReason] = useState<(typeof REASONS)[number]>("Stock count correction"), [note, setNote] = useState("");
  const [query, setQuery] = useState(""), [search, setSearch] = useState(""), [stock, setStock] = useState("");
  const [cursor, setCursor] = useState<string | null>(null), [history, setHistory] = useState<Array<string | null>>([]), [next, setNext] = useState<string | null>(null);
  const [error, setError] = useState(""), [rowErrors, setRowErrors] = useState<Record<string, string>>({}), [saving, setSaving] = useState(false), [revision, setRevision] = useState(0);
  const requestKey = JSON.stringify([storeId, search, stock, cursor, revision]);
  const [loadedKey, setLoadedKey] = useState("");
  const loading = loadedKey !== requestKey;
  useEffect(() => {
    let active = true;
    if (!ready) return;
    const params = new URLSearchParams({ limit: "50", query: search });
    if (stock) params.set("stock", stock);
    if (cursor) params.set("cursor", cursor);
    void request<CatalogPage<InventoryRow>>("/inventory?" + params).then((page) => { if (active) { setRows(page.nodes); setNext(page.nextCursor); setError(""); } })
      .catch((failure: Error) => { if (active) setError(failure.message); }).finally(() => { if (active) setLoadedKey(requestKey); });
    return () => { active = false; };
  }, [request, ready, storeId, search, stock, cursor, revision, requestKey]);
  const [shownStore, setShownStore] = useState(storeId);
  if (shownStore !== storeId) { setShownStore(storeId); setDrafts({}); setRowErrors({}); setRows([]); setCursor(null); setHistory([]); }
  const changed = rows.filter((row) => drafts[row.variantId] !== undefined && drafts[row.variantId] !== String(row.quantity ?? 0));
  useUnsavedChangesWarning(changed.length > 0);
  const reset = () => { setCursor(null); setHistory([]); };

  /** Saves every changed row one by one; rows that fail keep their typed value and say why. */
  async function saveAll() {
    const invalid = changed.filter((row) => !/^\d+$/.test(drafts[row.variantId]) || !Number.isSafeInteger(Number(drafts[row.variantId])));
    if (invalid.length) { setRowErrors(Object.fromEntries(invalid.map((row) => [row.variantId, "Enter a whole number, zero or more."]))); return; }
    setSaving(true); setRowErrors({});
    const text = note.trim() ? `${reason}: ${note.trim()}` : reason;
    let saved = 0;
    const failures: Record<string, string> = {};
    for (const row of changed) {
      try {
        const result = await request<InventoryRow>("/inventory/" + encodeURIComponent(row.variantId), { method: "PATCH", body: JSON.stringify({ quantity: Number(drafts[row.variantId]), expectedRevision: row.revision, note: text }) });
        setRows((current) => current.map((item) => item.variantId === result.variantId ? result : item));
        setDrafts((current) => { const copy = { ...current }; delete copy[row.variantId]; return copy; });
        saved += 1;
      } catch (failure) { failures[row.variantId] = failure instanceof Error ? failure.message : "Could not save stock."; }
    }
    setRowErrors(failures);
    setSaving(false);
    if (saved) { toast(`Stock saved for ${saved} ${saved === 1 ? "item" : "items"}`); setNote(""); }
  }

  const columns: IndexColumn<InventoryRow>[] = [
    { id: "product", header: "Product", mobile: "primary", cell: (row) => <div><Link className="jk-cell-strong" href={"/admin/products/" + row.productId}>{row.productTitle}</Link><span className="jk-cell-sub">{row.variantTitle}</span></div> },
    { id: "sku", header: "SKU", mobile: "hidden", cell: (row) => <div>{row.sku || <span className="jk-muted">None</span>}{row.barcode && <span className="jk-cell-sub">{row.barcode}</span>}</div> },
    { id: "status", header: "Status", cell: (row) => { const status = row.trackInventory ? row.stockStatus ?? "in_stock" : "untracked"; return <StatusBadge tone={STATUS_TONE[status]}>{STOCK_STATUS_LABEL[status]}</StatusBadge>; } },
    { id: "held", header: "Held by checkouts", align: "end", cell: (row) => row.trackInventory ? row.reserved : <span className="jk-muted">None</span> },
    { id: "available", header: "Available", align: "end", cell: (row) => row.availableQuantity ?? <span className="jk-muted">None</span> },
    { id: "onhand", header: "On hand", align: "end", cell: (row) => row.trackInventory && row.revision ? <div className="jk-stock-edit">
      <input className="jk-number-input" aria-label={"On hand for " + row.productTitle + " " + row.variantTitle} aria-invalid={Boolean(rowErrors[row.variantId])} inputMode="numeric"
        value={drafts[row.variantId] ?? String(row.quantity ?? 0)} onChange={(event) => setDrafts((current) => ({ ...current, [row.variantId]: event.target.value }))} />
      {rowErrors[row.variantId] && <small className="jk-field-error" role="alert">{rowErrors[row.variantId]}</small>}
    </div> : <Link className="jk-link" href={"/admin/products/" + row.productId}>Turn on tracking</Link> },
    { id: "history", header: "History", hideHeader: true, align: "end", cell: (row) => row.trackInventory ? <button type="button" className="jk-button" aria-label={"Stock history for " + row.productTitle + " " + row.variantTitle} onClick={() => setHistoryRow(row)}>History</button> : null },
  ];

  return <AdminPage title="Inventory" description="How many of each product you have. Change a number, then save. Available is what shoppers can still buy: on hand minus what checkouts are holding."
    secondaryActions={[{ label: "Refresh stock", onAction: () => setRevision((n) => n + 1), disabled: loading }]}>
    {changed.length > 0 && <Banner tone="info" title={`${changed.length} ${changed.length === 1 ? "count" : "counts"} changed`}>
      <div className="jk-row mt-2">
        <label className="jk-field"><span>Why did the stock change?</span><select className="jk-select" value={reason} onChange={(event) => setReason(event.target.value as (typeof REASONS)[number])}>{REASONS.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="jk-field min-w-56 flex-1"><span>Note (optional)</span><input maxLength={400} value={note} placeholder="For example, delivery from supplier" onChange={(event) => setNote(event.target.value)} /></label>
      </div>
    </Banner>}
    <IndexTable label="Stock" rows={rows} rowKey={(row) => row.variantId} rowLabel={(row) => `${row.productTitle} ${row.variantTitle}`} columns={columns}
      loading={loading} error={error} onRetry={() => setRevision((n) => n + 1)}
      tabs={TABS} activeTab={stock} onTabChange={(value) => { setStock(value); reset(); }}
      search={{ value: query, onChange: setQuery, label: "Search stock", placeholder: "Search by product, SKU or barcode, then press Enter", onSubmit: () => { setSearch(query); reset(); } }}
      emptyState={search || stock
        ? <EmptyState icon={Boxes} title={stock === "out" ? "Nothing is sold out" : stock === "low" ? "Nothing is running low" : "No matching products"} description="Choose All to see every product." />
        : <EmptyState icon={Boxes} title="No products to count yet" description="Add a product and turn on stock tracking to see it here." action={<Link href="/admin/products/new" className="jk-button jk-button-primary">Add product</Link>} />}
      pagination={{ hasPrevious: history.length > 0, hasNext: Boolean(next), onPrevious: () => { setCursor(history.at(-1) ?? null); setHistory((current) => current.slice(0, -1)); }, onNext: () => { setHistory((current) => [...current, cursor]); setCursor(next); } }} />
    <SaveBar dirty={changed.length > 0} saving={saving} onSave={() => void saveAll()} onDiscard={() => { setDrafts({}); setRowErrors({}); }} saveLabel={changed.length > 1 ? `Save ${changed.length} changes` : "Save"} />
    {historyRow && <StockHistory variantId={historyRow.variantId} title={historyRow.productTitle + " · " + historyRow.variantTitle} request={request} onClose={() => setHistoryRow(null)} />}
  </AdminPage>;
}
