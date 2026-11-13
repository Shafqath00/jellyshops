"use client";
import { useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Banner, Button, useToast } from "@/components/admin";
import { exportPath, type ExportFilters, type ProductBulkApi } from "./api";

type Scope = "all" | "filtered" | "selected";

/**
 * Export products as a spreadsheet in the same columns as the import template, so the file can be
 * edited and imported again. Offers the ticked rows, the list as it is filtered now, or everything.
 */
export function ExportDialog({ open, onOpenChange, api, selectedIds = [], filters = {}, className = "", overlayClassName = "" }: {
  open: boolean; onOpenChange: (open: boolean) => void; api: ProductBulkApi | null; selectedIds?: string[]; filters?: ExportFilters; className?: string; overlayClassName?: string;
}) {
  const toast = useToast();
  const filtered = Object.values(filters).some(Boolean);
  const [scopeChoice, setScope] = useState<Scope | null>(null);
  const scope: Scope = scopeChoice && (scopeChoice !== "selected" || selectedIds.length) && (scopeChoice !== "filtered" || filtered) ? scopeChoice : selectedIds.length ? "selected" : filtered ? "filtered" : "all";
  const [format, setFormat] = useState<"csv" | "xlsx">("xlsx");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run() {
    if (!api) return;
    setBusy(true); setError("");
    try {
      const result = await api.download(exportPath(format, scope === "selected" ? { ids: selectedIds } : scope === "filtered" ? { filters } : {}));
      toast(result.truncated ? "Exported the first 5,000 products. Filter the list to export the rest." : result.products != null ? `${result.products} ${result.products === 1 ? "product" : "products"} exported` : "Products exported");
      onOpenChange(false);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "The export did not finish. Try again."); }
    finally { setBusy(false); }
  }
  const option = (value: Scope, label: string, detail: string) => <label className="jk-check"><input type="radio" name="export-scope" checked={scope === value} onChange={() => setScope(value)} /><span>{label}<span className="jk-cell-sub">{detail}</span></span></label>;
  return <DialogPrimitive.Root open={open} onOpenChange={(value) => { if (!busy) { setError(""); onOpenChange(value); } }}>
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className={`jk-overlay ${overlayClassName}`} />
      <DialogPrimitive.Content className={`jk-dialog ${className}`} aria-describedby={undefined}>
        <DialogPrimitive.Title className="jk-dialog-title">Export products</DialogPrimitive.Title>
        <div className="jk-dialog-body">
          {error && <Banner tone="critical" title="Not exported">{error}</Banner>}
          <fieldset className="jk-stack-sm"><legend className="jk-strong">Which products</legend>
            {selectedIds.length > 0 && option("selected", `The ${selectedIds.length} you ticked`, "Only the rows selected in the list.")}
            {filtered && option("filtered", "The list as it is filtered now", "Uses your search, tab and filters.")}
            {option("all", "All products", "Every product in your store, up to 5,000.")}
          </fieldset>
          <fieldset className="jk-stack-sm"><legend className="jk-strong">File type</legend>
            <label className="jk-check"><input type="radio" name="export-format" checked={format === "xlsx"} onChange={() => setFormat("xlsx")} /><span>Excel (.xlsx)<span className="jk-cell-sub">Best for Excel, Numbers and Google Sheets. Keeps codes such as 00123 as they are.</span></span></label>
            <label className="jk-check"><input type="radio" name="export-format" checked={format === "csv"} onChange={() => setFormat("csv")} /><span>CSV<span className="jk-cell-sub">Plain text that any spreadsheet or other system can open.</span></span></label>
          </fieldset>
          <p className="jk-muted">One row per item you sell. Edit the file and import it again to change many products at once; nothing is duplicated.</p>
        </div>
        <div className="jk-dialog-footer">
          <DialogPrimitive.Close asChild><Button disabled={busy}>Cancel</Button></DialogPrimitive.Close>
          <Button variant="primary" loading={busy} loadingLabel="Preparing file…" disabled={!api} onClick={() => void run()}>Export products</Button>
        </div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root>;
}
