"use client";

import { useEffect, useState } from "react";
import { Banner, Button, SkeletonBlock } from "@/components/admin";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { ADJUSTMENT_REASON_LABEL, type InventoryAdjustmentReason } from "@/features/product-builder/stock";

export interface StockAdjustment { id: string; quantityDelta: number; quantityAfter: number; reason: InventoryAdjustmentReason; note: string | null; actor: string | null; createdAt: string }
interface HistoryPage { nodes: StockAdjustment[]; nextCursor: string | null }

type Props = {
  variantId: string;
  title: string;
  request: <T>(path: string, init?: RequestInit) => Promise<T>;
  onClose: () => void;
};

const PAGE_SIZE = 20;
const pageUrl = (variantId: string, cursor: string | null) => `/inventory/${encodeURIComponent(variantId)}/history?limit=${PAGE_SIZE}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
const messageOf = (caught: unknown) => caught instanceof Error ? caught.message : "Could not load the stock history.";

/** Every change to what is on hand for one variant, newest first. */
export function StockHistory({ variantId, title, request, onClose }: Props) {
  const [entries, setEntries] = useState<StockAdjustment[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  // The first page, and again whenever the seller retries after an error.
  useEffect(() => {
    let active = true;
    request<HistoryPage>(pageUrl(variantId, null))
      .then((page) => { if (active) { setEntries(page.nodes); setNext(page.nextCursor); setError(""); } })
      .catch((caught: unknown) => { if (active) setError(messageOf(caught)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [request, variantId, attempt]);

  async function loadOlder(cursor: string) {
    setLoading(true);
    try {
      const page = await request<HistoryPage>(pageUrl(variantId, cursor));
      setEntries((current) => [...current, ...page.nodes]);
      setNext(page.nextCursor);
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="jk-sheet overflow-y-auto">
        <SheetTitle>Stock history</SheetTitle>
        <SheetDescription>{title}</SheetDescription>
        {error && <Banner tone="critical" title="Could not load the stock history" action={<Button size="small" onClick={() => { setError(""); setLoading(true); setAttempt((count) => count + 1); }}>Try again</Button>}>{error}</Banner>}
        {!error && !loading && entries.length === 0 && <p className="jk-muted">No changes recorded yet. Stock changes made before history was added are not listed.</p>}
        {entries.length > 0 && (
          <ol aria-label="Stock changes" className="jk-rows">
            {entries.map((entry) => (
              <li key={entry.id} className="jk-rows-item is-top">
                <div className="min-w-0 flex-1">
                  <p className="jk-strong">{ADJUSTMENT_REASON_LABEL[entry.reason] ?? "Stock change"}</p>
                  {entry.note && <p className="jk-muted">{entry.note}</p>}
                  <p className="jk-cell-sub"><time dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleString()}</time></p>
                </div>
                <div className="jk-end">
                  <p className={`jk-strong tabular-nums ${entry.quantityDelta < 0 ? "jk-negative" : ""}`} aria-label={`${entry.quantityDelta > 0 ? "Added" : "Removed"} ${Math.abs(entry.quantityDelta)}`}>{entry.quantityDelta > 0 ? "+" : "−"}{Math.abs(entry.quantityDelta)}</p>
                  <p className="jk-cell-sub">{entry.quantityAfter} on hand</p>
                </div>
              </li>
            ))}
          </ol>
        )}
        {loading && <div className="jk-stack-sm" role="status" aria-label="Loading stock history"><SkeletonBlock height={14} width="60%" /><SkeletonBlock height={14} width="40%" /></div>}
        {next && !loading && <div><Button onClick={() => void loadOlder(next)}>Show older changes</Button></div>}
      </SheetContent>
    </Sheet>
  );
}
