"use client";
import { MessageSquareText } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AdminPage, ConfirmDialog, EmptyState, IndexTable, StatusBadge, useClientList, useToast, type IndexColumn, type IndexTab } from "@/components/admin";
import { useAdminReviews, type MerchantReview, type ReviewStatus } from "@/features/admin/api/reviews-api";

const STATUS_LABEL: Record<ReviewStatus, string> = { pending: "Waiting", published: "Published", hidden: "Hidden" };
const STATUS_TONE = { pending: "warning", published: "success", hidden: "neutral" } as const;

function stars(rating: number): string {
  return "★".repeat(rating) + "☆".repeat(5 - rating);
}

/** Products > Reviews: shoppers' reviews wait here until the merchant publishes them. */
export default function ReviewsPage() {
  const { list, setStatus, remove, ready, storeId } = useAdminReviews();
  const toast = useToast();
  const [tab, setTab] = useState<ReviewStatus | "">("pending");
  const [rows, setRows] = useState<MerchantReview[]>([]);
  const [counts, setCounts] = useState<Record<ReviewStatus, number>>({ pending: 0, published: 0, hidden: 0 });
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState<MerchantReview | null>(null);
  const [revision, setRevision] = useState(0);
  const requestKey = JSON.stringify([storeId, tab, revision]);
  const [loadedKey, setLoadedKey] = useState("");
  const loading = loadedKey !== requestKey;
  useEffect(() => {
    if (!ready) return;
    let active = true;
    list(tab).then((result) => { if (active) { setRows(result.reviews); setCounts(result.counts); setError(""); } })
      .catch((failure: Error) => { if (active) setError(failure.message); })
      .finally(() => { if (active) setLoadedKey(requestKey); });
    return () => { active = false; };
  }, [list, ready, storeId, tab, revision, requestKey]);
  const change = useCallback(async (ids: string[], status: ReviewStatus) => {
    try {
      for (const id of ids) await setStatus(id, status);
      toast(`${ids.length} ${ids.length === 1 ? "review" : "reviews"} ${status === "published" ? "published" : "hidden"}`);
      setRevision((value) => value + 1);
    } catch (failure) { toast((failure as Error).message); }
  }, [setStatus, toast]);
  const shown = useClientList(rows, { text: (row) => `${row.productTitle} ${row.authorName} ${row.authorEmail ?? ""} ${row.title ?? ""} ${row.body ?? ""}`, noun: ["review", "reviews"], searchLabel: "Search reviews" });
  const tabs: IndexTab[] = [
    { id: "pending", label: "Waiting", count: counts.pending },
    { id: "published", label: "Published", count: counts.published },
    { id: "hidden", label: "Hidden", count: counts.hidden },
    { id: "", label: "All" },
  ];
  const columns: IndexColumn<MerchantReview>[] = [
    { id: "review", header: "Review", mobile: "primary", cell: (row) => <div className="grid gap-1">
      <span aria-label={`${row.rating} out of 5 stars`} className="tracking-wide">{stars(row.rating)}</span>
      {row.title && <strong>{row.title}</strong>}
      {row.body && <span className="line-clamp-3 whitespace-pre-line">{row.body}</span>}
    </div> },
    { id: "product", header: "Product", cell: (row) => row.productTitle },
    { id: "author", header: "From", cell: (row) => <div className="grid"><span>{row.authorName}</span>{row.authorEmail && <a href={`mailto:${row.authorEmail}`} className="text-sm underline">{row.authorEmail}</a>}</div> },
    { id: "date", header: "Sent", cell: (row) => new Date(row.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) },
    { id: "status", header: "Status", cell: (row) => <StatusBadge tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</StatusBadge> },
    { id: "actions", header: "Actions", hideHeader: true, align: "end", cell: (row) => <div className="flex flex-wrap justify-end gap-2">
      {row.status !== "published" && <button type="button" className="jk-button jk-button-primary" onClick={() => void change([row.id], "published")}>Publish</button>}
      {row.status !== "hidden" && <button type="button" className="jk-button" onClick={() => void change([row.id], "hidden")}>Hide</button>}
      <button type="button" className="jk-button" onClick={() => setDeleting(row)} aria-label={`Delete the review from ${row.authorName}`}>Delete</button>
    </div> },
  ];
  return <AdminPage title="Reviews" description="Reviews from shoppers wait here until you publish them. Only published reviews appear in your store.">
    <IndexTable
      label="Reviews"
      rows={shown.rows}
      search={shown.search}
      pagination={shown.pagination}
      rowKey={(row) => row.id}
      rowLabel={(row) => `Review from ${row.authorName}`}
      columns={columns}
      loading={loading}
      error={error}
      onRetry={() => setRevision((value) => value + 1)}
      tabs={tabs}
      activeTab={tab}
      onTabChange={(id) => setTab(id as ReviewStatus | "")}
      bulkActions={[
        { label: "Publish", onAction: (ids) => change(ids, "published") },
        { label: "Hide", onAction: (ids) => change(ids, "hidden") },
      ]}
      emptyState={shown.filtered ? <EmptyState icon={MessageSquareText} title="No matching reviews" description="Try another search, or another tab." /> : <EmptyState icon={MessageSquareText} title={tab === "pending" ? "No reviews waiting" : "No reviews here yet"} description="Add the Reviews section to your product page in the theme editor so shoppers can write reviews." />}
    />
    <ConfirmDialog
      open={Boolean(deleting)}
      onOpenChange={(open) => { if (!open) setDeleting(null); }}
      title="Delete this review?"
      description={deleting ? `The review from ${deleting.authorName} will be removed for good. To keep it but not show it, hide it instead.` : ""}
      confirmLabel="Delete review"
      destructive
      onConfirm={async () => {
        if (!deleting) return;
        try { await remove(deleting.id); toast("Review deleted"); setRevision((value) => value + 1); }
        catch (failure) { toast((failure as Error).message); }
        finally { setDeleting(null); }
      }}
    />
  </AdminPage>;
}
