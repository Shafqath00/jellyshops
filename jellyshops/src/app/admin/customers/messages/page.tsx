"use client";
import { AdminPage, Banner, EmptyState, StatusBadge, TableSkeleton } from "@/components/admin";
import { useCallback, useEffect, useState } from "react";
import { MessageSquare, Search } from "lucide-react";
import { useAuth } from "@/features/auth/providers/auth-provider";

interface Enquiry { id: string; name: string; email: string; message: string; status: "NEW" | "READ" | "CLOSED"; revision: number; createdAt: string }
const apiOrigin = (process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001").replace(/\/$/, "");
export default function EngagementPage() {
  const { activeStore, session } = useAuth();
  const [items, setItems] = useState<Enquiry[]>([]);
  const [error, setError] = useState<string>();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const storeId = activeStore?.id ?? ""; const token = session?.access_token;
  const load = useCallback(async () => {
    if (!storeId || !token) return [] as Enquiry[];
    const response = await fetch(`${apiOrigin}/api/stores/${encodeURIComponent(storeId)}/engagement/enquiries`, { cache: "no-store", headers: { Authorization: `Bearer ${token}` } });
    const data = await response.json() as { enquiries?: Enquiry[]; error?: { message?: string } };
    if (!response.ok) throw new Error(data.error?.message ?? "Unable to load contact messages.");
    return data.enquiries ?? [];
  }, [storeId, token]);
  useEffect(() => {
    let active = true;
    void load().then((nextItems) => { if (active) setItems(nextItems); }).catch((caught: unknown) => {
      if (active) setError(caught instanceof Error ? caught.message : "Unable to load messages.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [load]);
  async function update(item: Enquiry, status: Enquiry["status"]) {
    if (!storeId || !token) return;
    setBusy(true); setError(undefined);
    try {
      const response = await fetch(`${apiOrigin}/api/stores/${encodeURIComponent(storeId)}/engagement/enquiries/${encodeURIComponent(item.id)}`, { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ status, revision: item.revision }) });
      const data = await response.json() as Enquiry | { error?: { message?: string } };
      if (!response.ok) throw new Error((data as { error?: { message?: string } }).error?.message ?? "Unable to update this message.");
      setItems((current) => current.map((entry) => entry.id === item.id ? data as Enquiry : entry));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to update this message."); }
    finally { setBusy(false); }
  }
  async function exportSubscribers() {
    if (!storeId || !token) return;
    setBusy(true); setError(undefined);
    try {
      const response = await fetch(`${apiOrigin}/api/stores/${encodeURIComponent(storeId)}/engagement/subscribers.csv`, { cache: "no-store", headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error("Subscriber export is unavailable.");
      const url = URL.createObjectURL(await response.blob()); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${activeStore?.slug ?? "store"}-subscribers.csv`; anchor.click(); URL.revokeObjectURL(url);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to download subscribers."); }
    finally { setBusy(false); }
  }
  const visible = items.filter((item) => (!statusFilter || item.status === statusFilter) && `${item.name} ${item.email} ${item.message}`.toLowerCase().includes(search.toLowerCase()));
  const counts = { "": items.length, NEW: items.filter((item) => item.status === "NEW").length, READ: items.filter((item) => item.status === "READ").length, CLOSED: items.filter((item) => item.status === "CLOSED").length };
  const retry = () => { setError(undefined); setLoading(true); void load().then(setItems).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Unable to load messages.")).finally(() => setLoading(false)); };
  return <AdminPage title="Messages & subscribers" description="Questions sent through your store's contact form, and people who joined your newsletter."
    secondaryActions={[{ label: "Export subscribers", onAction: () => void exportSubscribers(), disabled: busy }]}>
    {error && <Banner tone="critical" title="Something went wrong" action={<button type="button" className="jk-button" onClick={retry}>Retry</button>}>{error}</Banner>}
    <section className="jk-index">
      <div className="jk-tabs" role="tablist" aria-label="Message status">
        {([["", "All"], ["NEW", "New"], ["READ", "Read"], ["CLOSED", "Closed"]] as const).map(([value, text]) => <button key={value} type="button" role="tab" className="jk-tab" aria-selected={statusFilter === value} onClick={() => setStatusFilter(value)}>{text}{counts[value] > 0 && <span className="jk-tab-count">{counts[value]}</span>}</button>)}
      </div>
      <div className="jk-toolbar">
        <label className="jk-search"><Search size={16} aria-hidden="true" /><input type="search" aria-label="Search messages" placeholder="Search name, email or message" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      </div>
      {loading ? <TableSkeleton rows={4} columns={3} label="Loading messages" /> : visible.length ? <ul className="jk-list" style={{ marginTop: 0 }}>{visible.map((item) => <li key={item.id}>
        <details className="jk-message">
          <summary className="jk-message-summary">
            <span className="min-w-0 flex-1"><span className="jk-row" style={{ flexWrap: "nowrap" }}><span className="jk-strong truncate">{item.name}</span><StatusBadge kind="message" value={item.status} /></span>
              <span className="jk-cell-sub truncate">{item.message}</span></span>
            <time className="jk-muted" dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</time>
          </summary>
          <div className="jk-message-body">
            <a className="jk-link" href={`mailto:${encodeURIComponent(item.email)}`}>{item.email}</a>
            <p className="jk-message-text">{item.message}</p>
            <div className="jk-row">
              <label className="jk-field"><span className="sr-only">Status</span><select aria-label={`Status for ${item.name}`} value={item.status} disabled={busy} onChange={(event) => void update(item, event.target.value as Enquiry["status"])}><option value="NEW">New</option><option value="READ">Read</option><option value="CLOSED">Closed</option></select></label>
              <a className="jk-button" href={`mailto:${encodeURIComponent(item.email)}`}>Reply by email</a>
            </div>
          </div>
        </details>
      </li>)}</ul> : !error && <EmptyState icon={MessageSquare} title={items.length ? "No matching messages" : "No messages yet"} description="Messages sent through your store's contact form appear here." />}
    </section>
  </AdminPage>;
}
