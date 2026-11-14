"use client";
import { useMemo, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowRight } from "lucide-react";
import { Banner, Button, Field, useToast } from "@/components/admin";
import type { CatalogAdminProduct } from "@/features/store-editor/api/types";
import { planBulkEdit, type BulkChange } from "./bulk-edit";

type Kind = BulkChange["kind"];
const KINDS: Array<{ value: Kind; label: string }> = [
  { value: "price", label: "Price" }, { value: "compareAt", label: "Compare-at price" }, { value: "stock", label: "Stock" }, { value: "status", label: "Status" },
  { value: "collection", label: "Collections" }, { value: "tags", label: "Tags" }, { value: "vendor", label: "Brand" }, { value: "productType", label: "Type" },
];
const HOWS: Partial<Record<Kind, Array<{ value: string; label: string }>>> = {
  price: [{ value: "set", label: "Set to" }, { value: "raise", label: "Raise by an amount" }, { value: "lower", label: "Lower by an amount" }, { value: "raisePercent", label: "Raise by a percentage" }, { value: "lowerPercent", label: "Lower by a percentage" }],
  compareAt: [{ value: "set", label: "Set to" }, { value: "clear", label: "Remove it" }],
  stock: [{ value: "set", label: "Set to" }, { value: "add", label: "Add" }, { value: "take", label: "Take away" }],
  collection: [{ value: "add", label: "Add to" }, { value: "remove", label: "Remove from" }],
  tags: [{ value: "add", label: "Add" }, { value: "remove", label: "Remove" }],
};
const VALUE_LABEL: Partial<Record<Kind, string>> = { price: "Amount", compareAt: "Amount", stock: "How many", tags: "Tags", vendor: "Brand", productType: "Type" };
const VALUE_HELP: Partial<Record<Kind, string>> = {
  tags: "Separate several tags with commas.", vendor: "Leave empty to remove the brand.", productType: "Leave empty to remove the type.",
  stock: "Only items that track stock change.", compareAt: "The price before a discount, shown crossed out.",
};
const PREVIEW_ROWS = 100;
/** The most products one bulk edit will load and change. */
export const BULK_EDIT_MAX = 1000;

/**
 * Changes one thing on every selected product: choose the change, see each value before and after,
 * then confirm. Products are saved one at a time; a failure is listed and the rest carry on.
 */
export function BulkEditDialog({ open, onOpenChange, products: ticked, collections, money, save, onDone, loadAllMatching, className = "", overlayClassName = "" }: {
  open: boolean; onOpenChange: (open: boolean) => void; products: CatalogAdminProduct[]; collections: Array<{ id: string; title: string }>;
  /** Loads every product that matches the list's search, tab and filters (up to BULK_EDIT_MAX), so the change can cover more than the ticked rows. */
  loadAllMatching?: () => Promise<{ products: CatalogAdminProduct[]; more: boolean }>;
  money: (minor: number) => string; save: (productId: string, body: Record<string, unknown>) => Promise<unknown>; onDone: () => void; className?: string; overlayClassName?: string;
}) {
  const toast = useToast();
  const [kind, setKind] = useState<Kind>("price");
  const [how, setHow] = useState("set");
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<"ACTIVE" | "DRAFT" | "ARCHIVED">("ACTIVE");
  const [collectionId, setCollectionId] = useState("");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [failures, setFailures] = useState<string[]>([]);
  const [all, setAll] = useState<{ products: CatalogAdminProduct[]; more: boolean } | null>(null);
  const [loadingAll, setLoadingAll] = useState(false);
  const [loadError, setLoadError] = useState("");
  const products = all?.products ?? ticked;
  async function widen() {
    if (!loadAllMatching) return;
    setLoadingAll(true); setLoadError("");
    try { setAll(await loadAllMatching()); }
    catch (failure) { setLoadError(failure instanceof Error ? failure.message : "The products could not be loaded. Try again."); }
    finally { setLoadingAll(false); }
  }
  const change = useMemo((): BulkChange => {
    switch (kind) {
      case "price": return { kind, how: how as Extract<BulkChange, { kind: "price" }>["how"], amount: value };
      case "compareAt": return { kind, how: how === "clear" ? "clear" : "set", amount: value };
      case "stock": return { kind, how: how as "set" | "add" | "take", amount: value };
      case "status": return { kind, status };
      case "collection": return { kind, how: how === "remove" ? "remove" : "add", collectionId, collectionTitle: collections.find((item) => item.id === collectionId)?.title ?? "" };
      case "tags": return { kind, how: how === "remove" ? "remove" : "add", tags: value };
      case "vendor": return { kind, value };
      case "productType": return { kind, value };
    }
  }, [kind, how, value, status, collectionId, collections]);
  const needsValue = kind !== "status" && kind !== "collection" && !(kind === "compareAt" && how === "clear");
  const untouched = needsValue && !value.trim() && kind !== "vendor" && kind !== "productType";
  const plan = useMemo(() => planBulkEdit(products, change, money), [products, change, money]);
  const busy = progress !== null;
  const percent = kind === "price" && (how === "raisePercent" || how === "lowerPercent");

  function choose(next: Kind) { setKind(next); setHow(HOWS[next]?.[0].value ?? "set"); setValue(""); setFailures([]); }
  async function apply() {
    setFailures([]); setProgress({ done: 0, total: plan.patches.length });
    const failed: string[] = [];
    for (const [index, patch] of plan.patches.entries()) {
      try { await save(patch.productId, patch.body); }
      catch (failure) { failed.push(`${patch.title}: ${failure instanceof Error ? failure.message : "could not be saved"}`); }
      setProgress({ done: index + 1, total: plan.patches.length });
    }
    setProgress(null);
    onDone();
    const saved = plan.patches.length - failed.length;
    if (failed.length) { setFailures(failed); if (saved) toast(`${saved} ${saved === 1 ? "product" : "products"} changed`); }
    else { toast(`${saved} ${saved === 1 ? "product" : "products"} changed`); onOpenChange(false); }
  }

  return <DialogPrimitive.Root open={open} onOpenChange={(next) => { if (!busy) { setFailures([]); onOpenChange(next); } }}>
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className={`jk-overlay ${overlayClassName}`} />
      <DialogPrimitive.Content className={`jk-dialog jk-dialog-wide ${className}`} aria-describedby={undefined}>
        <DialogPrimitive.Title className="jk-dialog-title">Bulk edit {products.length.toLocaleString("en-GB")} {products.length === 1 ? "product" : "products"}</DialogPrimitive.Title>
        <div className="jk-dialog-body jk-dialog-scroll">
          {failures.length > 0 && <Banner tone="critical" title={`${failures.length} ${failures.length === 1 ? "product was" : "products were"} not changed`}><ul className="jk-bullets">{failures.slice(0, 8).map((line) => <li key={line}>{line}</li>)}</ul></Banner>}
          {loadAllMatching && <div className="jk-row is-between jk-scope">
            <p className="jk-muted" role="status">{all ? `Editing all ${products.length.toLocaleString("en-GB")} products that match your search and filters${all.more ? ` (the first ${BULK_EDIT_MAX.toLocaleString("en-GB")}; repeat for the rest)` : ""}.` : `Editing the ${products.length} you ticked.`}</p>
            {all ? <Button size="small" variant="quiet" disabled={busy} onClick={() => setAll(null)}>Back to the ticked ones</Button>
              : <Button size="small" loading={loadingAll} loadingLabel="Loading products…" disabled={busy} onClick={() => void widen()}>Edit every matching product instead</Button>}
          </div>}
          {loadError && <Banner tone="critical">{loadError}</Banner>}
          <div className="jk-grid-3">
            <Field id="bulk-kind" label="Change"><select id="bulk-kind" value={kind} disabled={busy} onChange={(event) => choose(event.target.value as Kind)}>{KINDS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field>
            {HOWS[kind] && <Field id="bulk-how" label="How"><select id="bulk-how" value={how} disabled={busy} onChange={(event) => setHow(event.target.value)}>{HOWS[kind]!.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field>}
            {kind === "status" && <Field id="bulk-status" label="New status"><select id="bulk-status" value={status} disabled={busy} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="ACTIVE">Active</option><option value="DRAFT">Draft</option><option value="ARCHIVED">Archived</option></select></Field>}
            {kind === "collection" && <Field id="bulk-collection" label="Collection"><select id="bulk-collection" value={collectionId} disabled={busy} onChange={(event) => setCollectionId(event.target.value)}><option value="">Choose a collection</option>{collections.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></Field>}
            {needsValue && <Field id="bulk-value" label={percent ? "Percentage" : VALUE_LABEL[kind] ?? "Value"} help={percent ? "Like 10 or 12.5." : VALUE_HELP[kind]} error={!untouched && plan.error ? plan.error : undefined}>
              <input id="bulk-value" value={value} disabled={busy} inputMode={kind === "tags" || kind === "vendor" || kind === "productType" ? "text" : "decimal"} onChange={(event) => setValue(event.target.value)} />
            </Field>}
          </div>
          {kind === "status" && status === "ARCHIVED" && <Banner tone="warning">Archived products are hidden from your store. You can make them active again later.</Banner>}
          {untouched || plan.error ? <p className="jk-muted">{kind === "collection" ? (collections.length ? "Choose a collection to see what will change." : "Your store has no collections yet. Create one under Products, then Collections.") : "Fill in the change to see each value before and after."}</p> : <>
            <p className="jk-strong" role="status">{plan.changed} {plan.changed === 1 ? "value" : "values"} will change{plan.unchanged ? `, ${plan.unchanged} will stay as ${plan.unchanged === 1 ? "it is" : "they are"}` : ""}.</p>
            <div className="jk-table-scroll jk-preview-table"><table className="jk-table" aria-label="Before and after">
              <thead><tr><th scope="col">Product</th><th scope="col">{plan.label}: before</th><th scope="col"><span className="sr-only">becomes</span></th><th scope="col">After</th></tr></thead>
              <tbody>{plan.rows.slice(0, PREVIEW_ROWS).map((row, index) => <tr key={index} className={row.changed ? "" : "is-muted"}>
                <td data-mobile="primary"><span className="jk-strong">{row.product}</span>{row.item && <span className="jk-cell-sub">{row.item}</span>}</td>
                <td data-label="Before">{row.before}</td>
                <td data-mobile="hidden" aria-hidden="true"><ArrowRight size={14} /></td>
                <td data-label="After">{row.changed ? <strong>{row.after}</strong> : row.after}{row.note && <span className="jk-cell-sub">{row.note}</span>}</td>
              </tr>)}</tbody>
            </table></div>
            {plan.rows.length > PREVIEW_ROWS && <p className="jk-muted">Showing the first {PREVIEW_ROWS} of {plan.rows.length} values. All of them will be changed.</p>}
          </>}
          {busy && <div className="jk-progress-block" role="status" aria-live="polite"><progress className="jk-progress" max={progress.total} value={progress.done} aria-label="Saving changes" /><span>Saving {progress.done} of {progress.total}…</span></div>}
        </div>
        <div className="jk-dialog-footer">
          <DialogPrimitive.Close asChild><Button disabled={busy}>{failures.length ? "Close" : "Cancel"}</Button></DialogPrimitive.Close>
          <Button variant="primary" loading={busy} loadingLabel="Saving…" disabled={Boolean(plan.error) || untouched || plan.patches.length === 0} onClick={() => void apply()}>
            {plan.patches.length ? `Change ${plan.patches.length} ${plan.patches.length === 1 ? "product" : "products"}` : "Nothing to change"}
          </Button>
        </div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root>;
}
