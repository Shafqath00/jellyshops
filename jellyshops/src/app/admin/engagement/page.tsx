"use client";
import { AdminPageHeader, AdminEmptyState, AdminNotice } from "@/components/admin-ui";
import { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";
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
    });
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
  return <main>
    <AdminPageHeader title="Messages & subscribers" actions={<button className="admin-button" type="button" onClick={() => void exportSubscribers()} disabled={busy}><Download size={16} /> Export subscribers</button>} />
    {error && <AdminNotice error>{error}<button className="ml-3 underline" onClick={() => { setError(undefined); void load().then(setItems).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Unable to load messages.")); }}>Retry</button></AdminNotice>}
    <section className="admin-card !p-0">
      <div className="admin-toolbar"><input className="admin-search" aria-label="Search messages" placeholder="Search name, email or message" value={search} onChange={(event) => setSearch(event.target.value)} /><select aria-label="Filter message status" className="admin-button" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">All messages</option><option value="NEW">New</option><option value="READ">Read</option><option value="CLOSED">Closed</option></select></div>
      {visible.map((item) => <details key={item.id} className="border-b border-border last:border-0"><summary className="cursor-pointer px-4 py-3"><span className="font-medium">{item.name}</span><span className="ml-3 text-muted-foreground">{item.status.toLowerCase()} · {new Date(item.createdAt).toLocaleDateString()}</span><span className="mt-1 block truncate text-muted-foreground">{item.message}</span></summary><div className="border-t border-border px-4 py-3"><a className="underline" href={`mailto:${encodeURIComponent(item.email)}`}>{item.email}</a><p className="my-4 whitespace-pre-wrap leading-6">{item.message}</p><label className="admin-field max-w-48">Status<select aria-label={`Status for ${item.name}`} value={item.status} disabled={busy} onChange={(event) => void update(item, event.target.value as Enquiry["status"])}><option value="NEW">New</option><option value="READ">Read</option><option value="CLOSED">Closed</option></select></label></div></details>)}
      {!visible.length && !error && <AdminEmptyState title={items.length ? "No matching messages" : "No messages yet"}>Messages sent through your storefront appear here.</AdminEmptyState>}
    </section>
  </main>;
}
